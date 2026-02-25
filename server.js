const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

io.on("connection", (socket) => {
  socket.on("join-room", ({ roomId, userName }) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = { users: {}, revealed: false, adminId: socket.id };
    }

    rooms[roomId].users[socket.id] = {
      name: userName,
      vote: null,
      isSpectator: isSpectator,
    };
    io.to(roomId).emit("update-room", rooms[roomId]);
  });

  socket.on("change-name", ({ roomId, newName }) => {
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      rooms[roomId].users[socket.id].name = newName;
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("reset-game", (roomId) => {
    if (rooms[roomId] && rooms[roomId].adminId === socket.id) {
      // Opcional: emitir um evento 'add-to-history' com os dados atuais antes de resetar
      rooms[roomId].revealed = false;
      Object.keys(rooms[roomId].users).forEach(
        (id) => (rooms[roomId].users[id].vote = null),
      );
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("cast-vote", ({ roomId, vote }) => {
    if (rooms[roomId]) {
      rooms[roomId].users[socket.id].vote = vote;
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("reveal-votes", (roomId) => {
    if (rooms[roomId] && rooms[roomId].adminId === socket.id) {
      rooms[roomId].revealed = true;
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("reset-game", (roomId) => {
    if (rooms[roomId] && rooms[roomId].adminId === socket.id) {
      rooms[roomId].revealed = false;
      Object.keys(rooms[roomId].users).forEach(
        (id) => (rooms[roomId].users[id].vote = null),
      );
      io.to(roomId).emit("update-room", rooms[roomId]);
    }
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        delete rooms[roomId].users[socket.id];
        if (Object.keys(rooms[roomId].users).length === 0) delete rooms[roomId];
        else io.to(roomId).emit("update-room", rooms[roomId]);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => console.log(`Rodando na porta ${PORT}`));
