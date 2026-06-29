import React, { useState } from 'react';
import api from '../../utils/api';

export default function CreateSquadModal({ isOpen, onClose, onSquadCreated }) {
  const [squadName, setSquadName] = useState('');
  const [squadGoal, setSquadGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!squadName.trim() || !squadGoal.trim()) return;
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const response = await api.post('/squads/', {
        name: squadName,
        goal: squadGoal
      });
      
      // Clear the form on success
      setSquadName('');
      setSquadGoal('');
      
      // Pass the new squad data back to the parent to refresh the list
      if (onSquadCreated) {
        onSquadCreated(response.data);
      }
      
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-8 shadow-xl animate-fade-in">
        
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
          {/* Squad Name */}
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

          {/* Squad Goal */}
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

          {/* Note about Statuses */}
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong className="text-gray-900 font-semibold">Next Step:</strong> You will be taken to your dashboard where you can customize daily status tags and generate an invite link.
            </p>
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