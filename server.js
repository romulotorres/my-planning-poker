const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};
// Valores permitidos para evitar "votos engraçadinhos"
const VALID_VOTES = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "☕", "?"];

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userName, isSpectator }) => {
    if (!roomId || !userName) return; // Validação básica de entrada
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: {},
        revealed: false,
        adminId: socket.id,
        revealedAt: null,
      };
    }
    rooms[roomId].users[socket.id] = {
      name: userName,
      vote: null,
      isSpectator: !!isSpectator,
    };
    io.to(roomId).emit("update-room", rooms[roomId]);
  });

  socket.on("change-name", ({ roomId, newName }) => {
    if (rooms[roomId] && rooms[roomId].users[socket.id] && newName) {
      rooms[roomId].users[socket.id].name = newName.substring(0, 20); // Limite de caracteres
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("cast-vote", ({ roomId, vote }) => {
    const room = rooms[roomId];
    if (room && room.users[socket.id] && !room.users[socket.id].isSpectator) {
      // CAMADA DE VALIDAÇÃO: Só aceita se o voto estiver na lista permitida
      if (VALID_VOTES.includes(vote)) {
        room.users[socket.id].vote = vote;
        io.to(roomId).emit("update-room", room);
      } else {
        console.log(`Tentativa de voto inválido por ${socket.id}: ${vote}`);
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
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`Proteção ativa em http://localhost:${PORT}`),
);
