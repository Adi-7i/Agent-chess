/**
 * Main server entry point
 * Sets up Express server with Socket.io for real-time communication
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { ChessGame } = require('./game');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(`${__dirname}/../client/build`));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Game instance
let game = null;

function resolvePlayersFromRequest(body = {}) {
  const requestedX = String(body.llmXColor || '').toLowerCase();
  const requestedY = String(body.llmYColor || '').toLowerCase();

  let llmXColor = requestedX === 'black' ? 'black' : 'white';
  let llmYColor = requestedY === 'white' ? 'white' : 'black';

  if (llmXColor === llmYColor) {
    llmYColor = llmXColor === 'white' ? 'black' : 'white';
  }

  return {
    whitePlayer: llmXColor === 'white' ? 'LLM_X' : 'LLM_Y',
    blackPlayer: llmXColor === 'black' ? 'LLM_X' : 'LLM_Y',
    llmXColor,
    llmYColor
  };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send current game state to newly connected client
  if (game) {
    socket.emit('game_state', game.getState());
  }

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// REST API endpoints
app.post('/api/game/start', (req, res) => {
  const { speed = 1000, maxMoves = 100 } = req.body;
  
  if (game && game.isRunning) {
    return res.status(400).json({ error: 'Game already in progress' });
  }

  const playerMapping = resolvePlayersFromRequest(req.body);

  game = new ChessGame(io, {
    speed,
    maxMoves,
    whitePlayer: playerMapping.whitePlayer,
    blackPlayer: playerMapping.blackPlayer
  });
  game.start().catch((error) => {
    console.error('Failed to start game loop:', error.message);
  });

  res.json({
    message: 'Game started',
    playerMapping,
    state: game.getState()
  });
});

app.post('/api/game/restart', (req, res) => {
  const { speed = 1000, maxMoves = 100 } = req.body;
  
  if (game) {
    game.stop();
  }

  const playerMapping = resolvePlayersFromRequest(req.body);

  game = new ChessGame(io, {
    speed,
    maxMoves,
    whitePlayer: playerMapping.whitePlayer,
    blackPlayer: playerMapping.blackPlayer
  });
  
  res.json({
    message: 'Game restarted',
    playerMapping,
    state: game.getState()
  });
});

app.post('/api/game/stop', (req, res) => {
  if (game) {
    game.stop();
    res.json({ message: 'Game stopped', state: game.getState() });
  } else {
    res.status(400).json({ error: 'No game in progress' });
  }
});

app.get('/api/game/state', (req, res) => {
  if (game) {
    res.json(game.getState());
  } else {
    res.status(404).json({ error: 'No game found' });
  }
});

// Speed control endpoint
app.post('/api/game/speed', (req, res) => {
  const { speed } = req.body;
  
  if (game && speed > 0) {
    game.setSpeed(speed);
    res.json({ message: `Speed updated to ${speed}ms`, speed });
  } else {
    res.status(400).json({ error: 'Invalid speed or no game in progress' });
  }
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

module.exports = { app, server, io };
