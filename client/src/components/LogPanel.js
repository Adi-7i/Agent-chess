/**
 * LogPanel Component
 * Displays game logs and LLM decisions
 */

import React, { useState } from 'react';
import '../styles/LogPanel.css';

function LogPanel({ logs }) {
  const [expanded, setExpanded] = useState(false);

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatData = (data) => {
    if (!data) return '';
    if (typeof data === 'string') return data;
    return JSON.stringify(data);
  };

  return (
    <div className={`log-panel ${expanded ? 'expanded' : ''}`}>
      <div className="log-header" onClick={() => setExpanded(!expanded)}>
        <h3 className="panel-title">📋 Game Logs</h3>
        <button className="expand-btn">
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      <div className="log-content">
        {logs.length === 0 ? (
          <div className="no-logs">No logs yet</div>
        ) : (
          <div className="log-entries">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                <span className="log-message">{log.message}</span>
                {log.data && (
                  <span className="log-data">{formatData(log.data)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="log-footer">
          <span>{logs.length} log entries</span>
        </div>
      )}
    </div>
  );
}

export default LogPanel;
