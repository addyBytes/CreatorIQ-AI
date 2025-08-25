import React from 'react';

function VideoDetails({ details }) {
  const formattedViews = new Intl.NumberFormat().format(details.viewCount);
  return (
    <div className="video-details-card">
      <img src={details.thumbnail} alt="Video Thumbnail" className="thumbnail" />
      <div className="info">
        <h2 className="video-title">{details.title}</h2>
        <p className="view-count">Views: {formattedViews}</p>
        <div className="description-box">
          <h3>Description</h3>
          <p className="description-text">{details.description || 'No description available.'}</p>
        </div>
        {details.keywords && details.keywords.length > 0 && (
          <div className="keywords-box">
            <h3>Tags</h3>
            <div className="tags-container">
              {details.keywords.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VideoDetails;