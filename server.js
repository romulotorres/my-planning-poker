const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// CONFIGURAÇÃO DE ADMIN
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "314159265"; // Defina uma senha forte para o painel de controle
const VALID_VOTES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "☕", "?"];
const rooms = {};

// Rota do Painel de Controle
app.get("/admin-dashboard", (req, res) => {
  const { pw } = req.query;
  if (pw === ADMIN_PASSWORD) {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
  } else {
    res.status(401).send("Acesso negado.");
  }
});

io.on("connection", (socket) => {
  // Autenticação de Admin no Socket
  socket.on("request-admin-stats", (pw) => {
    if (pw === ADMIN_PASSWORD) {
      socket.join("admin-room");
      sendAdminUpdate();
    }
  });

  socket.on("join-room", ({ roomId, userName, isSpectator }) => {
    if (!roomId || !userName) return;
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        revealed: false,
        adminId: socket.id,
        revealedAt: null,
      };
    }
    // Limite de 50 caracteres para os nomes engraçados
    rooms[roomId].users[socket.id] = {
      name: userName.substring(0, 50),
      vote: null,
      isSpectator: !!isSpectator,
    };
    io.to(roomId).emit("update-room", rooms[roomId]);
    sendAdminUpdate();
  });

  socket.on("cast-vote", ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (room && room.users[socket.id] && !room.users[socket.id].isSpectator) {
      if (VALID_VOTES.includes(vote)) {
        room.users[socket.id].vote = vote;
        io.to(roomId).emit("update-room", room);
      }
    }
  });

  socket.on("reveal-votes", (roomId) => {
    if (rooms[roomId] && rooms[roomId].adminId === socket.id) {
      rooms[roomId].revealed = true;
      rooms[roomId].revealedAt = Date.now();
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("reset-game", (roomId) => {
    if (rooms[roomId] && rooms[roomId].adminId === socket.id) {
      rooms[roomId].revealed = false;
      rooms[roomId].revealedAt = null;
      Object.keys(rooms[roomId].users).forEach(
        (id) => (rooms[roomId].users[id].vote = null),
      );
      io.to(roomId).emit("clear-local-votes");
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        const wasAdmin = rooms[roomId].adminId === socket.id;
        delete rooms[roomId].users[socket.id];
        if (Object.keys(rooms[roomId].users).length === 0) {
          delete rooms[roomId];
        } else {
          if (wasAdmin)
            rooms[roomId].adminId = Object.keys(rooms[roomId].users)[0];
          io.to(roomId).emit("update-room", rooms[roomId]);
        }
      }
    }
    sendAdminUpdate();
  });
});

function sendAdminUpdate() {
  const stats = {
    totalRooms: Object.keys(rooms).length,
    totalUsers: Object.values(rooms).reduce(
      (acc, r) => acc + Object.keys(r.users).length,
      0,
    ),
    details: Object.keys(rooms).map((id) => ({
      name: id,
      count: Object.keys(rooms[id].users).length,
    })),
  };
  io.to("admin-room").emit("admin-stats-update", stats);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
