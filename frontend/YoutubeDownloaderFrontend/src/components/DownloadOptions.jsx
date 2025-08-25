import React, { useState } from 'react';

function DownloadOptions({ details, videoURL, socketId, onDownloadStart }) {
  const defaultQuality = details.videoFormats.find(f => f.qualityLabel)?.itag || '';
  const [selectedQuality, setSelectedQuality] = useState(defaultQuality);

  const startDownload = (downloadUrl) => {
    onDownloadStart();
    window.open(downloadUrl, '_blank');
  };

  const handleDownloadVideo = () => {
    const downloadUrl = `http://localhost:5000/download?url=${encodeURIComponent(videoURL)}&format=mp4&quality=${selectedQuality}&socketId=${socketId}`;
    startDownload(downloadUrl);
  };

  const handleDownloadAudio = () => {
    const downloadUrl = `http://localhost:5000/download?url=${encodeURIComponent(videoURL)}&format=m4a&socketId=${socketId}`;
    startDownload(downloadUrl);
  };

  return (
    <div className="download-container">
        <div className="quality-selection">
          <label htmlFor="quality-select">Select Video Quality:</label>
          <select 
            id="quality-select"
            value={selectedQuality}
            onChange={(e) => setSelectedQuality(e.target.value)}
          >
            {details.videoFormats.map((format, index) => (
              format.qualityLabel && (
                <option key={`${format.itag}-${index}`} value={format.itag}>
                  {format.qualityLabel} ({format.container})
                </option>
              )
            ))}
          </select>
         
          <button onClick={handleDownloadVideo}>
            Download Video
          </button>
        </div>
        <div className="other-downloads">
          
          <button onClick={handleDownloadAudio}>
            Download Audio (M4A)
          </button>
          <a 
            className="thumbnail-download-btn"
            href={details.thumbnail} 
            download="thumbnail.jpg"
          >
            Download Thumbnail
          </a>
        </div>
    </div>
  );
}

export default DownloadOptions;