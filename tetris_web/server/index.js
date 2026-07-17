const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3005;

// Keep track of rooms
// rooms = { roomCode: [socketId1, socketId2] }
const rooms = {};

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  socket.on('join_room', (roomCode) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
    }

    if (rooms[roomCode].length >= 2) {
      socket.emit('room_full', roomCode);
      return;
    }

    socket.join(roomCode);
    rooms[roomCode].push(socket.id);
    
    console.log(`User ${socket.id} joined room ${roomCode}`);

    socket.emit('joined_room', roomCode);

    if (rooms[roomCode].length === 2) {
      io.to(roomCode).emit('game_start');
    }
  });

  socket.on('send_state', (data) => {
    // data: { roomCode, boardState, score }
    // Broadcast to the other player in the room
    socket.to(data.roomCode).emit('receive_state', data);
  });

  socket.on('send_garbage', (data) => {
    // data: { roomCode, lines }
    // Broadcast to the other player in the room
    socket.to(data.roomCode).emit('receive_garbage', data);
  });

  socket.on('game_over', (data) => {
    socket.to(data.roomCode).emit('opponent_game_over');
  });

  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    // Find rooms this user was in and remove them
    for (const roomCode in rooms) {
      rooms[roomCode] = rooms[roomCode].filter(id => id !== socket.id);
      if (rooms[roomCode].length === 0) {
        delete rooms[roomCode];
      } else {
        // Notify remaining player
        io.to(roomCode).emit('opponent_disconnected');
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
