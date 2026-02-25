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
  socket.on("join-room", ({ roomId, userName, isSpectator }) => {
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

  socket.on("cast-vote", ({ roomId, vote }) => {
    if (rooms[roomId] && !rooms[roomId].users[socket.id].isSpectator) {
      rooms[roomId].users[socket.id].vote = vote;
      io.to(roomId).emit("update-room", rooms[roomId]);
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
      io.to(roomId).emit("clear-local-votes"); // Comando para limpar o azul das cartas
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
server.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
