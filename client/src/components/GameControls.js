import React, { useState } from 'react';
import '../styles/GameControls.css';

const SPEED_OPTIONS = [
  { label: 'Slow', value: 3000 },
  { label: 'Normal', value: 1000 },
  { label: 'Fast', value: 500 },
  { label: 'Turbo', value: 250 }
];

function GameControls({ gameState, onStart, onRestart, onStop, onSpeedChange }) {
  const [speed, setSpeed] = useState(1000);
  const [maxMoves, setMaxMoves] = useState(100);
  const [llmXColor, setLlmXColor] = useState('white');
  const [llmYColor, setLlmYColor] = useState('black');

  const isRunning = Boolean(gameState?.isRunning);

  const buildGameConfig = () => ({
    speed,
    maxMoves,
    llmXColor,
    llmYColor
  });

  const handleStart = () => {
    onStart(buildGameConfig());
  };

  const handleRestart = () => {
    onRestart(buildGameConfig());
  };

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    if (isRunning) {
      onSpeedChange(newSpeed);
    }
  };

  const handleXColorChange = (value) => {
    const nextX = value;
    const nextY = value === 'white' ? 'black' : 'white';
    setLlmXColor(nextX);
    setLlmYColor(nextY);
  };

  const handleYColorChange = (value) => {
    const nextY = value;
    const nextX = value === 'white' ? 'black' : 'white';
    setLlmYColor(nextY);
    setLlmXColor(nextX);
  };

  return (
    <div className="game-controls">
      <div className="player-assignment">
        <h3 className="control-section-title">Player Assignment</h3>
        <div className="assignment-grid">
          <label className="control-label" htmlFor="llm-x-color">
            LLM_X Color
          </label>
          <select
            id="llm-x-color"
            className="color-select"
            value={llmXColor}
            onChange={(event) => handleXColorChange(event.target.value)}
            disabled={isRunning}
          >
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>

          <label className="control-label" htmlFor="llm-y-color">
            LLM_Y Color
          </label>
          <select
            id="llm-y-color"
            className="color-select"
            value={llmYColor}
            onChange={(event) => handleYColorChange(event.target.value)}
            disabled={isRunning}
          >
            <option value="white">White</option>
            <option value="black">Black</option>
          </select>
        </div>
      </div>

      <div className="control-group">
        <button
          className="btn btn-start"
          onClick={handleStart}
          disabled={isRunning}
        >
          ▶ Start Game
        </button>

        <button
          className="btn btn-restart"
          onClick={handleRestart}
          disabled={isRunning}
        >
          🔄 Restart
        </button>

        <button
          className="btn btn-stop"
          onClick={onStop}
          disabled={!isRunning}
        >
          ⏸ Stop
        </button>
      </div>

      <div className="speed-control">
        <label className="control-label">Move Delay:</label>
        <div className="speed-buttons">
          {SPEED_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`speed-btn ${speed === opt.value ? 'active' : ''}`}
              onClick={() => handleSpeedChange(opt.value)}
              disabled={isRunning}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-moves-control">
        <label className="control-label" htmlFor="max-moves-input">
          Max Moves
        </label>
        <input
          id="max-moves-input"
          type="number"
          value={maxMoves}
          onChange={(e) => setMaxMoves(parseInt(e.target.value, 10) || 100)}
          min="10"
          max="500"
          className="max-moves-input"
          disabled={isRunning}
        />
      </div>

      {isRunning && (
        <div className="game-info">
          <span>Move: {gameState.moveCount}</span>
          <span>Delay: {gameState.speed}ms</span>
          <span>{gameState.turn === 'w' ? 'White' : 'Black'} to move</span>
        </div>
      )}
    </div>
  );
}

export default GameControls;
