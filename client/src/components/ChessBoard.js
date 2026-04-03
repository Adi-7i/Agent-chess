/**
 * ChessBoard Component
 * Renders the chess board with pieces and animations
 */

import React, { useEffect, useState } from 'react';
import '../styles/ChessBoard.css';

// Unicode chess pieces
const PIECES = {
  'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function ChessBoard({ gameState }) {
  const [lastMove, setLastMove] = useState(null);
  const [board, setBoard] = useState(null);

  useEffect(() => {
    if (gameState?.board) {
      setBoard(gameState.board);
      if (gameState.moveHistory.length > 0) {
        setLastMove(gameState.moveHistory[gameState.moveHistory.length - 1]);
      }
    }
  }, [gameState]);

  if (!board) {
    return (
      <div className="chessboard-container">
        <div className="loading-board">Waiting for game to start...</div>
      </div>
    );
  }

  const getSquareColor = (row, col) => {
    const isLight = (row + col) % 2 === 0;
    return isLight ? 'light' : 'dark';
  };

  const isHighlighted = (row, col) => {
    if (!lastMove) return false;
    const fromFile = FILES.indexOf(lastMove.from[0]);
    const fromRank = 8 - parseInt(lastMove.from[1]);
    const toFile = FILES.indexOf(lastMove.to[0]);
    const toRank = 8 - parseInt(lastMove.to[1]);
    
    return (row === fromRank && col === fromFile) || (row === toRank && col === toFile);
  };

  const getPieceSymbol = (piece) => {
    if (!piece) return '';
    const color = piece.color === 'w' ? 'w' : 'b';
    const type = piece.type.toUpperCase();
    return PIECES[`${color}${type}`] || '';
  };

  return (
    <div className="chessboard-container">
      <div className="board-wrapper">
        {/* File labels (top) */}
        <div className="file-labels file-labels-top">
          {FILES.map(f => (
            <span key={f} className="file-label">{f}</span>
          ))}
        </div>

        <div className="board-with-rank">
          {/* Rank labels (left) */}
          <div className="rank-labels">
            {RANKS.map(r => (
              <span key={r} className="rank-label">{r}</span>
            ))}
          </div>

          {/* The actual board */}
          <div className="chessboard">
            {board.map((row, rowIndex) => (
              <div key={rowIndex} className="board-row">
                {row.map((piece, colIndex) => {
                  const squareColor = getSquareColor(rowIndex, colIndex);
                  const highlighted = isHighlighted(rowIndex, colIndex);
                  const pieceSymbol = getPieceSymbol(piece);
                  const squareName = `${FILES[colIndex]}${RANKS[rowIndex]}`;

                  return (
                    <div
                      key={colIndex}
                      className={`square ${squareColor} ${highlighted ? 'highlighted' : ''}`}
                      data-square={squareName}
                    >
                      {pieceSymbol && (
                        <span className={`piece ${piece?.color === 'w' ? 'white-piece' : 'black-piece'}`}>
                          {pieceSymbol}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* File labels (bottom) */}
        <div className="file-labels file-labels-bottom">
          {FILES.map(f => (
            <span key={f} className="file-label">{f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChessBoard;
