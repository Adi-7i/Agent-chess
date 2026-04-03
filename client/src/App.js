/**
 * Main App Component
 * Orchestrates the chess game UI with real-time updates
 */

import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import ChessBoard from './components/ChessBoard';
import GameControls from './components/GameControls';
import MoveHistory from './components/MoveHistory';
import GameStatus from './components/GameStatus';
import LogPanel from './components/LogPanel';
import './styles/App.css';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

function App() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [connected, setConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnected(false);
    });

    newSocket.on('game_state', (state) => {
      setGameState(state);
    });

    newSocket.on('move_made', (payload) => {
      console.log('Move made:', payload);
    });

    newSocket.on('game_over', (result) => {
      console.log('Game over:', result);
    });

    newSocket.on('turn_start', (data) => {
      console.log('Turn started:', data);
    });

    newSocket.on('log', (log) => {
      setLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const startGame = useCallback((config) => {
    if (socket) {
      fetch(`${SOCKET_URL}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }).catch(err => console.error('Failed to start game:', err));
    }
  }, [socket]);

  const restartGame = useCallback((config) => {
    if (socket) {
      fetch(`${SOCKET_URL}/api/game/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }).catch(err => console.error('Failed to restart game:', err));
    }
  }, [socket]);

  const stopGame = useCallback(() => {
    if (socket) {
      fetch(`${SOCKET_URL}/api/game/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error('Failed to stop game:', err));
    }
  }, [socket]);

  const changeSpeed = useCallback((speed) => {
    if (socket) {
      fetch(`${SOCKET_URL}/api/game/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed })
      }).catch(err => console.error('Failed to change speed:', err));
    }
  }, [socket]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>♟️ LLM Chess Arena</h1>
        <p className="subtitle">Watch two AI agents compete in real-time</p>
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      <main className="app-main">
        <div className="game-section">
          <GameStatus gameState={gameState} />
          <ChessBoard gameState={gameState} />
          <GameControls 
            gameState={gameState}
            onStart={startGame}
            onRestart={restartGame}
            onStop={stopGame}
            onSpeedChange={changeSpeed}
          />
        </div>

        <div className="side-panel">
          <MoveHistory moves={gameState?.moveHistory || []} />
          <LogPanel logs={logs} />
        </div>
      </main>
    </div>
  );
}

export default App;
