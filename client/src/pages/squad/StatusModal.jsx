import React from 'react';

export default function StatusModal({ isOpen, onClose, statusOptions, onSelectStatus, date }) {
  if (!isOpen) return null;

  const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-xl animate-fade-in">
        
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Update Status</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-900 transition text-2xl leading-none"
          >
            &times;
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mb-6">
          Setting your completion record for <span className="text-black font-semibold">{formattedDate}</span>.
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          {statusOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onSelectStatus(option.label, option.emoji);
                onClose();
              }}
              className="flex flex-col items-center p-4 bg-white border border-gray-200 hover:border-gray-400 hover:shadow-sm rounded-xl transition-all text-center group"
            >
              <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">{option.emoji}</span>
              <span className="text-sm font-semibold text-gray-600 group-hover:text-black transition-colors">{option.label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}