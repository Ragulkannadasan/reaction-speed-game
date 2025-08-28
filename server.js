const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// In-memory storage (replace with database in production)
const users = new Map();
const activeUsers = new Map();
const gameRooms = new Map();
const gameHistory = new Map();

// JWT Secret
const JWT_SECRET = 'your-secret-key-change-in-production';

// Auth Middleware
const protect = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
};


// Authentication endpoints
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    if (users.has(username)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    users.set(username, {
      id: userId,
      username,
      password: hashedPassword,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      createdAt: new Date()
    });
    
    gameHistory.set(userId, []);
    
    const token = jwt.sign({ userId, username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, userId, username });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const user = users.get(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, username }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, userId: user.id, username });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/me', protect, (req, res) => {
  const user = Array.from(users.values()).find(u => u.id === req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    userId: user.id,
    username: user.username,
  });
});


app.get('/api/users', (req, res) => {
  const userList = Array.from(users.values()).map(user => ({
    id: user.id,
    username: user.username,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    gamesLost: user.gamesLost,
    online: activeUsers.has(user.id)
  }));
  res.json(userList);
});

app.get('/api/user/:userId/stats', (req, res) => {
  const { userId } = req.params;
  const user = Array.from(users.values()).find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const history = gameHistory.get(userId) || [];
  res.json({
    username: user.username,
    gamesPlayed: user.gamesPlayed,
    gamesWon: user.gamesWon,
    gamesLost: user.gamesLost,
    winRate: user.gamesPlayed > 0 ? (user.gamesWon / user.gamesPlayed * 100).toFixed(1) : 0,
    history: history.slice(-10) // Last 10 games
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('user-login', (data) => {
    try {
      const { token } = data;
      if (!token) return;

      const decoded = jwt.verify(token, JWT_SECRET);
      const user = Array.from(users.values()).find(u => u.id === decoded.userId);

      if(user){
        activeUsers.set(user.id, {
        socketId: socket.id,
        username: user.username,
        userId: user.id,
        status: 'online'
      });
      socket.userId = user.id;
      
      // Broadcast updated user list
      io.emit('users-update', Array.from(activeUsers.values()));
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  });
  
  socket.on('send-game-request', (data) => {
    const { targetUserId, fromUser } = data;
    const targetUser = activeUsers.get(targetUserId);
    
    if (targetUser) {
      io.to(targetUser.socketId).emit('game-request-received', {
        from: fromUser,
        requestId: uuidv4()
      });
    }
  });
  
  socket.on('accept-game-request', (data) => {
    const { fromUserId, toUser } = data;
    const fromUser = activeUsers.get(fromUserId);
    
    if (fromUser) {
      const roomId = uuidv4();
      
      // Create game room
      gameRooms.set(roomId, {
        id: roomId,
        players: [
          { userId: fromUserId, socketId: fromUser.socketId, username: fromUser.username, ready: false },
          { userId: socket.userId, socketId: socket.id, username: toUser.username, ready: false }
        ],
        status: 'waiting',
        startTime: null,
        colorChangeTime: null,
        winner: null
      });
      
      // Join both players to room
      socket.join(roomId);
      io.sockets.sockets.get(fromUser.socketId)?.join(roomId);
      
      // Notify both players
      io.to(roomId).emit('game-room-joined', {
        roomId,
        players: gameRooms.get(roomId).players
      });
    }
  });
  
  socket.on('reject-game-request', (data) => {
    const { fromUserId } = data;
    const fromUser = activeUsers.get(fromUserId);
    
    if (fromUser) {
      io.to(fromUser.socketId).emit('game-request-rejected');
    }
  });
  
  socket.on('player-ready', (data) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.ready = true;
        
        // Check if both players are ready
        const allReady = room.players.every(p => p.ready);
        
        io.to(roomId).emit('player-ready-update', {
          players: room.players,
          allReady
        });
        
        if (allReady) {
          startGame(roomId);
        }
      }
    }
  });
  
  socket.on('button-click', (data) => {
    const { roomId, clickTime } = data;
    const room = gameRooms.get(roomId);
    
    if (room && room.status === 'playing') {
      const player = room.players.find(p => p.socketId === socket.id);
      
      if (room.colorChangeTime) {
        // Color has changed - valid click
        if (clickTime >= room.colorChangeTime) {
          // Player clicked after color change - they win
          endGame(roomId, player.userId, 'valid_click');
        } else {
          // Player clicked before color change - they lose
          const opponent = room.players.find(p => p.socketId !== socket.id);
          endGame(roomId, opponent.userId, 'early_click');
        }
      } else {
        // Color hasn't changed yet - player loses
        const opponent = room.players.find(p => p.socketId !== socket.id);
        endGame(roomId, opponent.userId, 'early_click');
      }
    }
  });
  
  socket.on('join-room', (data) => {
    const { roomId, user } = data;
    const room = gameRooms.get(roomId);
    
    if (room) {
      socket.join(roomId);
      socket.emit('room-joined', {
        roomId,
        players: room.players
      });
    } else {
      socket.emit('room-not-found');
    }
  });
  
  socket.on('leave-room', (data) => {
    const { roomId } = data;
    socket.leave(roomId);
    
    // Clean up room if empty
    const room = gameRooms.get(roomId);
    if (room) {
      const remainingPlayers = room.players.filter(p => p.socketId !== socket.id);
      if (remainingPlayers.length === 0) {
        gameRooms.delete(roomId);
      } else {
        room.players = remainingPlayers;
        io.to(roomId).emit('opponent-disconnected');
      }
    }
  });
  
  socket.on('forfeit-game', (data) => {
    const { roomId } = data;
    const room = gameRooms.get(roomId);
    
    if (room) {
      const player = room.players.find(p => p.socketId === socket.id);
      const opponent = room.players.find(p => p.socketId !== socket.id);
      
      if (opponent) {
        endGame(roomId, opponent.userId, 'forfeit');
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      activeUsers.delete(socket.userId);
      io.emit('users-update', Array.from(activeUsers.values()));
    }
    
    // Handle game room cleanup if player disconnects during game
    for (const [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex !== -1) {
        const opponent = room.players.find(p => p.socketId !== socket.id);
        if (opponent) {
          io.to(opponent.socketId).emit('opponent-disconnected');
        }
        gameRooms.delete(roomId);
        break;
      }
    }
  });
});

function startGame(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  room.status = 'playing';
  room.startTime = Date.now();
  
  // Random delay between 1-5 seconds for color change
  const delay = Math.random() * 4000 + 1000; // 1000-5000ms
  
  io.to(roomId).emit('game-started');
  
  setTimeout(() => {
    if (gameRooms.has(roomId)) {
      room.colorChangeTime = Date.now();
      io.to(roomId).emit('color-change', { changeTime: room.colorChangeTime });
    }
  }, delay);
}

function endGame(roomId, winnerId, reason) {
  const room = gameRooms.get(roomId);
  if (!room || room.status === 'finished') return;
  
  room.status = 'finished';
  room.winner = winnerId;
  
  const winner = room.players.find(p => p.userId === winnerId);
  const loser = room.players.find(p => p.userId !== winnerId);
  
  // Update user stats
  const winnerUser = Array.from(users.values()).find(u => u.id === winnerId);
  
  if (winnerUser && loser) {
    const loserUser = Array.from(users.values()).find(u => u.id === loser.userId);
    if (!loserUser) return;

    winnerUser.gamesPlayed++;
    winnerUser.gamesWon++;
    loserUser.gamesPlayed++;
    loserUser.gamesLost++;
    
    // Add to game history
    const gameData = {
      gameId: roomId,
      date: new Date(),
      opponent: loser.username,
      result: 'win',
      reason
    };
    
    const loserGameData = {
      gameId: roomId,
      date: new Date(),
      opponent: winner.username,
      result: 'loss',
      reason
    };
    
    gameHistory.get(winnerId).push(gameData);
    gameHistory.get(loser.userId).push(loserGameData);

    io.to(roomId).emit('game-ended', {
      winner: winner.username,
      winnerId,
      reason,
      stats: {
        [winnerId]: { gamesWon: winnerUser?.gamesWon || 0, gamesPlayed: winnerUser?.gamesPlayed || 0 },
        [loser.userId]: { gamesWon: loserUser?.gamesWon || 0, gamesPlayed: loserUser?.gamesPlayed || 0 }
      }
     });
  }
  
  // Clean up room after 5 seconds
  setTimeout(() => {
    gameRooms.delete(roomId);
  }, 5000);
}

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});