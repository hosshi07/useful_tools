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
// rooms = { roomCode: { players: [socketId1, socketId2], createdAt: number } }
const rooms = {};

function getAvailableRooms() {
  const list = [];
  for (const [code, info] of Object.entries(rooms)) {
    const players = Array.isArray(info) ? info : info.players;
    if (players && players.length === 1) {
      list.push({
        roomCode: code,
        playersCount: players.length,
        maxPlayers: 2,
        createdAt: info.createdAt || Date.now()
      });
    }
  }
  return list;
}

function broadcastRoomsList() {
  io.emit('rooms_list', getAvailableRooms());
}

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // Send current waiting rooms upon request (or reload button click)
  socket.on('get_rooms', () => {
    socket.emit('rooms_list', getAvailableRooms());
  });

  socket.on('join_room', (rawRoomCode) => {
    const roomCode = String(rawRoomCode || '').trim();
    if (!roomCode) return;

    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], createdAt: Date.now() };
    }

    const roomObj = rooms[roomCode];
    if (roomObj.players.includes(socket.id)) {
      return;
    }

    if (roomObj.players.length >= 2) {
      socket.emit('room_full', roomCode);
      broadcastRoomsList();
      return;
    }

    socket.join(roomCode);
    roomObj.players.push(socket.id);

    console.log(`User ${socket.id} joined room ${roomCode} (${roomObj.players.length}/2)`);

    socket.emit('joined_room', roomCode);
    broadcastRoomsList();

    if (roomObj.players.length === 2) {
      io.to(roomCode).emit('game_start');
    }
  });

  socket.on('send_state', (data) => {
    socket.to(data.roomCode).emit('receive_state', data);
  });

  socket.on('send_garbage', (data) => {
    socket.to(data.roomCode).emit('receive_garbage', data);
  });

  socket.on('game_over', (data) => {
    socket.to(data.roomCode).emit('opponent_game_over');
  });

  socket.on('leave_room', (roomCode) => {
    socket.leave(roomCode);
    if (rooms[roomCode]) {
      rooms[roomCode].players = rooms[roomCode].players.filter(id => id !== socket.id);
      if (rooms[roomCode].players.length === 0) {
        delete rooms[roomCode];
      } else {
        socket.to(roomCode).emit('opponent_disconnected');
      }
      broadcastRoomsList();
    }
  });

  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    let changed = false;
    for (const roomCode in rooms) {
      const beforeLen = rooms[roomCode].players.length;
      rooms[roomCode].players = rooms[roomCode].players.filter(id => id !== socket.id);
      if (rooms[roomCode].players.length !== beforeLen) {
        changed = true;
        if (rooms[roomCode].players.length === 0) {
          delete rooms[roomCode];
        } else {
          io.to(roomCode).emit('opponent_disconnected');
        }
      }
    }
    if (changed) {
      broadcastRoomsList();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
