/**
 * MoveHistory Component
 * Displays the list of moves made during the game
 */

import React, { useEffect, useRef } from 'react';
import '../styles/MoveHistory.css';

function MoveHistory({ moves }) {
  const containerRef = useRef(null);

  // Auto-scroll to bottom when new moves are added
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [moves]);

  // Group moves by turn number
  const groupedMoves = [];
  for (let i = 0; i < moves.length; i += 2) {
    const turnNumber = Math.floor(i / 2) + 1;
    groupedMoves.push({
      turn: turnNumber,
      white: moves[i],
      black: moves[i + 1] || null
    });
  }

  return (
    <div className="move-history">
      <h3 className="panel-title">📜 Move History</h3>
      
      <div className="moves-container" ref={containerRef}>
        {groupedMoves.length === 0 ? (
          <div className="no-moves">No moves yet. Start a game to begin!</div>
        ) : (
          <table className="moves-table">
            <thead>
              <tr>
                <th>#</th>
                <th>White</th>
                <th>Black</th>
              </tr>
            </thead>
            <tbody>
              {groupedMoves.map((group) => (
                <tr key={group.turn} className="move-row">
                  <td className="turn-number">{group.turn}</td>
                  <td className="move-cell">
                    <span className="move-san">{group.white?.san}</span>
                    <span className="move-detail">{group.white?.uci}</span>
                  </td>
                  <td className="move-cell">
                    {group.black ? (
                      <>
                        <span className="move-san">{group.black?.san}</span>
                        <span className="move-detail">{group.black?.uci}</span>
                      </>
                    ) : (
                      <span className="pending">...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {moves.length > 0 && (
        <div className="move-stats">
          <span>Total moves: {moves.length}</span>
        </div>
      )}
    </div>
  );
}

export default MoveHistory;
