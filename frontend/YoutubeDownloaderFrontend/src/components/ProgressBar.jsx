import React from 'react';

function ProgressBar({ progress }) {
  return (
    <div className="progress-bar-container">
      <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      <span className="progress-text">{progress}%</span>
    </div>
  );
}

export default ProgressBar;