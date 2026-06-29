import React, { useState } from 'react';
import api from '../../utils/api';
import EmojiPicker from 'emoji-picker-react'; // <-- Import the library

export default function CreateSquadModal({ isOpen, onClose, onSquadCreated }) {
  const [squadName, setSquadName] = useState('');
  const [squadGoal, setSquadGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Track which emoji picker is currently open (by index)
  const [activePickerIndex, setActivePickerIndex] = useState(null);
  
  const [statusOptions, setStatusOptions] = useState([
    { label: 'Crushed it', emoji: '🚀' },
      {label: "No Progress", "emoji": "❌"}
  ]);

  if (!isOpen) return null;

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...statusOptions];
    newOptions[index][field] = value;
    setStatusOptions(newOptions);
  };

  const onEmojiClick = (emojiObject, index) => {
    handleOptionChange(index, 'emoji', emojiObject.emoji);
    setActivePickerIndex(null); // Close the picker after selection
  };

  const addOption = () => {
    setStatusOptions([...statusOptions, { label: '', emoji: '🎯' }]); // Give a default emoji
  };

  const removeOption = (index) => {
    const newOptions = statusOptions.filter((_, i) => i !== index);
    setStatusOptions(newOptions);
    if (activePickerIndex === index) {
      setActivePickerIndex(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!squadName.trim() || !squadGoal.trim()) return;
    
    const validOptions = statusOptions.filter(opt => opt.label.trim() && opt.emoji.trim());
    if (validOptions.length === 0) {
      setError("Please add at least one valid status option with a label and emoji.");
      return;
    }

    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await api.post('/squads/', {
        name: squadName,
        goal: squadGoal,
        status_options: validOptions
      });
      
      setSquadName('');
      setSquadGoal('');
      setStatusOptions([
        { label: 'Crushed it', emoji: '🚀' },
        {label: "No Progress", "emoji": "❌"}
      ]);
      setActivePickerIndex(null);
      
      if (onSquadCreated) onSquadCreated(response.data);
      onClose();
    } catch (err) {
      console.error("Failed to create squad:", err);
      setError(
        err.response?.data?.detail || 
        "Something went wrong while creating your squad. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setError('');
    setActivePickerIndex(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-8 shadow-xl animate-fade-in my-8">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create New Squad</h2>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-gray-900 transition text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Squad Name & Goal inputs remain exactly the same... */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Squad Name</label>
            <input 
              type="text" 
              value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
              placeholder="e.g., The Midnight Coders" 
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Primary Goal</label>
            <textarea 
              value={squadGoal}
              onChange={(e) => setSquadGoal(e.target.value)}
              placeholder="e.g., Solve 2 LeetCode problems daily and share solutions." 
              rows="3"
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition resize-none"
              required
              disabled={isSubmitting}
            ></textarea>
          </div>

          {/* Dynamic Status Options with Emoji Picker */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Daily Status Tags</label>
            </div>
            
            <div className="space-y-3">
              {statusOptions.map((option, index) => (
                <div key={index} className="flex gap-2 relative">
                  
                  {/* Emoji Button */}
                  <button
                    type="button"
                    onClick={() => setActivePickerIndex(activePickerIndex === index ? null : index)}
                    className="w-16 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xl text-center rounded-xl px-2 py-3 focus:outline-none focus:ring-2 focus:ring-black transition flex items-center justify-center cursor-pointer"
                    disabled={isSubmitting}
                  >
                    {option.emoji}
                  </button>

                  {/* Pop-up Emoji Picker */}
                  {activePickerIndex === index && (
                    <div className="absolute top-14 left-0 z-10 shadow-2xl rounded-lg">
                      <EmojiPicker 
                        onEmojiClick={(emojiData) => onEmojiClick(emojiData, index)}
                        autoFocusSearch={false}
                        width={300}
                        height={400}
                      />
                    </div>
                  )}

                  <input 
                    type="text" 
                    value={option.label}
                    onChange={(e) => handleOptionChange(index, 'label', e.target.value)}
                    placeholder="Status Label (e.g., Crushed it)" 
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition"
                    required
                    disabled={isSubmitting}
                  />
                  
                  {statusOptions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="px-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
                      disabled={isSubmitting}
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addOption}
              disabled={isSubmitting}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium transition"
            >
              + Add another tag
            </button>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-black hover:bg-gray-800 text-white font-semibold py-3 rounded-xl transition shadow-sm disabled:opacity-70 flex justify-center items-center"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Creating...</span>
              ) : (
                "Initialize Squad"
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}