/**
 * GameStatus Component
 * Displays current game status (turn, checkmate, draw, etc.)
 */

import React from 'react';
import '../styles/GameStatus.css';

function GameStatus({ gameState }) {
  if (!gameState) {
    return (
      <div className="game-status">
        <div className="status-message">Connect to start playing</div>
      </div>
    );
  }

  const getStatusMessage = () => {
    if (gameState.gameOver) {
      if (gameState.winner) {
        return `🏆 ${gameState.winner} wins by ${gameState.reason}!`;
      }
      return `🤝 Game drawn: ${gameState.reason}`;
    }

    if (gameState.isRunning) {
      const currentPlayer = gameState.turn === 'w'
        ? gameState.whitePlayer
        : gameState.blackPlayer;
      const turnIcon = gameState.turn === 'w' ? '⬜' : '⬛';
      return `${turnIcon} ${currentPlayer}'s turn`;
    }

    return 'Ready to start a new game';
  };

  const getStatusClass = () => {
    if (gameState.gameOver) return 'game-over';
    if (gameState.isRunning) return 'in-progress';
    return 'waiting';
  };

  return (
    <div className="game-status">
      <div className={`status-indicator ${getStatusClass()}`}>
        <div className="status-text">{getStatusMessage()}</div>

        <div className="turn-indicator">
          <div className="player-badge white-player">
            ⬜ White: {gameState.whitePlayer}
          </div>
          <div className="player-badge black-player">
            ⬛ Black: {gameState.blackPlayer}
          </div>
        </div>
        
        {gameState.gameOver && (
          <div className="game-over-badge">
            {gameState.winner ? '👑 Checkmate!' : '🤝 Draw'}
          </div>
        )}
      </div>

      <div className="game-details">
        <div className="detail-item">
          <span className="detail-label">Moves:</span>
          <span className="detail-value">{gameState.moveCount}/{gameState.maxMoves}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Status:</span>
          <span className="detail-value">
            {gameState.isRunning ? 'Playing' : gameState.gameOver ? 'Ended' : 'Waiting'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default GameStatus;
