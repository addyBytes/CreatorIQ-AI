import React, { useState } from 'react';
import axios from 'axios';

const Markdown = ({ text }) => {
  return <div dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br />') }} />;
};

function AICoach({ videoDetails }) {
  const [messages, setMessages] = useState([
    { from: 'ai', text: 'Hello! I am your AI Video Coach. How can I help you?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { from: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await axios.post('http://localhost:5000/chat-with-ai', {
        videoDetails: videoDetails,
        userQuestion: input
      });
      const aiMessage = { from: 'ai', text: response.data.answer };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { from: 'ai', text: 'Sorry, I had trouble connecting. Please try again.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="ai-coach-container">
      <h3>AI Video Coach</h3>
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.from}`}>
            <Markdown text={msg.text} />
          </div>
        ))}
        {isTyping && <div className="message ai typing"><span></span><span></span><span></span></div>}
      </div>
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={isTyping}
        />
        <button type="submit" disabled={isTyping}>Send</button>
      </form>
    </div>
  );
}

export default AICoach;