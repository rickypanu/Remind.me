import React, { useState, useEffect, useRef } from "react";
import SquadFeed from "./SquadFeed"; // Your existing component

export default function ChatContainer({ currentUserId, currentUserName }) {
  // State to hold all messages
  const [feedItems, setFeedItems] = useState([]);

  // Use a ref to store the WebSocket instance so it persists across renders
  const ws = useRef(null);

  useEffect(() => {
    // 1. Define the dynamic URL
    const wsUrl = import.meta.env.VITE_WS_URL || "ws://localhost:8000/chat";

    // 2. Create the socket using that dynamic URL
    const socket = new WebSocket(wsUrl);

    // 3. Assign THAT socket to your reference (no hardcoded localhost!)
    ws.current = socket;

    // 2. Listen for incoming messages from the server
    ws.current.onmessage = (event) => {
      const incomingMessage = JSON.parse(event.data);

      // Add the new message to the existing feed array
      setFeedItems((prevItems) => [...prevItems, incomingMessage]);
    };

    // 3. Handle connection errors
    ws.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    // 4. Cleanup function: close the connection when the user leaves the page
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // 5. Function to send messages to the server
  const handleSendMessage = (messageText) => {
    const newMessage = {
      id: Date.now().toString(), // Generate a unique ID (or let backend do this)
      type: "user",
      userId: currentUserId,
      userName: currentUserName,
      text: messageText,
      timestamp: new Date().toISOString(),
    };

    // Send the message to the backend via WebSocket
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(newMessage));

      // Optional: Optimistically add your own message to the screen instantly
      // (Alternatively, wait for the server to broadcast it back to you)
      setFeedItems((prevItems) => [...prevItems, newMessage]);
    } else {
      console.error("WebSocket is not connected.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Pass the state and functions to your existing component */}
      <SquadFeed
        feedItems={feedItems}
        onSendMessage={handleSendMessage}
        currentUserId={currentUserId}
      />
    </div>
  );
}
