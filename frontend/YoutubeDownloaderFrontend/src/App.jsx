import { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import VideoDetails from './components/VideoDetails';
import DownloadOptions from './components/DownloadOptions';
import ProgressBar from './components/ProgressBar';
import AICoach from './components/AICoach';



const socket = io("http://localhost:5000", {
  transports: ["websocket"], 
});


function App() {
  const [videoURL, setVideoURL] = useState('');
  const [videoDetails, setVideoDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [socketId, setSocketId] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [isPlaylistDownloading, setIsPlaylistDownloading] = useState(false);
  const [playlistStatus, setPlaylistStatus] = useState('');

  const isPlaylist = videoURL.includes('playlist');

  useEffect(() => {
    socket.on('connect', () => setSocketId(socket.id));
    socket.on('downloadProgress', (data) => {
      setDownloadProgress(data.progress);
      if (data.progress === 100) setTimeout(() => setIsDownloading(false), 2000);
    });
    socket.on('playlistProgress', (data) => setPlaylistStatus(data.message));
    socket.on('playlistFinished', (data) => {
      setPlaylistStatus('Playlist ZIP is ready! Starting download...');
      window.location.href = `http://localhost:5000${data.downloadUrl}`;
      setTimeout(() => setIsPlaylistDownloading(false), 5000);
    });
    socket.on('playlistError', (message) => {
      setError(message);
      setIsPlaylistDownloading(false);
    });
    return () => socket.disconnect();
  }, []);

  const handleGetDetails = async () => {
    if (!videoURL) return setError('Please paste a YouTube URL first.');
    if (isPlaylist) return setError('This is a playlist URL. Please use the "Download Playlist" button.');
    
    setError('');
    setVideoDetails(null);
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:5000/details?url=${encodeURIComponent(videoURL)}`);
      setVideoDetails(response.data);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to fetch video details.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPlaylist = () => {
    if (!videoURL) return setError('Please paste a playlist URL first.');
    if (!isPlaylist) return setError('This is not a playlist URL.');
    setIsPlaylistDownloading(true);
    setVideoDetails(null);
    setError('');
    socket.emit('downloadPlaylist', { playlistURL: videoURL });
  };

  return (
    <div className="container">
      <h1>CreatorIQ AI</h1>
      <h3 className='subDesc'>A YouTube AI Content Analyzer & Media Saver</h3>
      <div className="url-input-section">
        <input
          type="text"
          value={videoURL}
          onChange={(e) => setVideoURL(e.target.value)}
          placeholder="Paste YouTube URL or Playlist URL here..."
        />
        {isPlaylist ? (
          <button onClick={handleDownloadPlaylist} disabled={isPlaylistDownloading} className="playlist-btn">
            Download Playlist as ZIP
          </button>
        ) : (
          <button onClick={handleGetDetails} disabled={isLoading}>
            {isLoading ? 'Getting...' : 'Get Video Details'}
          </button>
        )}
      </div>

      {isLoading && <div className="loader"></div>}
      {error && <p className="error-message">{error}</p>}
      
      {isPlaylistDownloading && (
        <div className="playlist-status">
          <div className="loader"></div>
          <p>{playlistStatus}</p>
        </div>
      )}

      {isDownloading && <ProgressBar progress={downloadProgress} />}
      
      {videoDetails && !isDownloading && !isPlaylistDownloading && (
        <div className="main-content-area">
          <div className="details-and-downloads-column">
            <VideoDetails details={videoDetails} />
            <DownloadOptions 
              details={videoDetails} 
              videoURL={videoURL} 
              socketId={socketId}
              onDownloadStart={() => setIsDownloading(true)}
            />
          </div>
          <div className="ai-coach-column">
            <AICoach videoDetails={videoDetails} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;