import React, { useState, useRef, useEffect } from "react";

export default function SquadFeed({ feedItems, onSendMessage, currentUserId }) {
  const [msg, setMsg] = useState("");
  const feedEndRef = useRef(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [feedItems]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!msg.trim()) return;
    onSendMessage(msg);
    setMsg("");
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl flex flex-col h-[400px] overflow-hidden shadow-sm">
      <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">
          Activity Log & Discussion
        </h3>
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      </div>

      {/* Main Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {feedItems.map((item) => {
          if (item.type === "system") {
            return (
              <div key={item.id} className="flex justify-center my-2">
                <span className="bg-gray-50 border border-gray-200 text-[11px] text-gray-500 px-3 py-1.5 rounded-full text-center shadow-sm font-medium">
                  {item.text}
                </span>
              </div>
            );
          }

          const isSelf = item.userId === currentUserId;
          return (
            <div
              key={item.id}
              className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                  isSelf
                    ? "bg-black text-white rounded-tr-sm"
                    : "bg-gray-100 text-gray-900 rounded-tl-sm border border-gray-200/60"
                }`}
              >
                {!isSelf && (
                  <p className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wide">
                    {item.userName}
                  </p>
                )}
                <p className="leading-relaxed break-words">{item.text}</p>
              </div>
              <span className="text-[9px] text-gray-400 mt-1.5 px-1 font-medium">
                {new Date(
                  item.timestamp.endsWith("Z")
                    ? item.timestamp
                    : item.timestamp + "Z",
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          );
        })}
        <div ref={feedEndRef} />
      </div>

      {/* Message input bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 bg-gray-50 border-t border-gray-200 flex gap-2"
      >
        <input
          type="text"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Ask a doubt or talk strategy..."
          className="flex-1 bg-white border border-gray-200 rounded-xl px-4 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition shadow-sm"
        />
        <button
          type="submit"
          className="bg-black hover:bg-gray-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm flex items-center justify-center"
        >
          Send
        </button>
      </form>
    </div>
  );
}
