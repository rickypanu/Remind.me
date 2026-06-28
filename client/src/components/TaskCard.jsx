import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Trash2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function TaskCard({ task, refreshTasks, isPrevious }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // --- NEW UX STATES ---
  const [localStatus, setLocalStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false); // Handles the exit delay

  // Keep local state in sync if data changes from the parent
  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  const handleStatusChange = async () => {
    // Prevent spam clicking while loading or transitioning
    if (isUpdating || isTransitioning) return;
    
    setIsUpdating(true);
    const newStatus = localStatus === 'pending' ? 'completed' : 'pending';
    
    try {
      // 1. Wait for API to finish saving
      await api.put(`/tasks/${task.id}?status=${newStatus}`);
      
      // 2. API Success -> Immediately update the local UI (Turns text gray & checkmark green)
      setLocalStatus(newStatus);
      setIsUpdating(false);
      setIsTransitioning(true);
      
      // 3. Add a 600ms delay before telling the Dashboard to fetch new data.
      // This gives the user time to see the satisfying green checkmark!
      setTimeout(() => {
        refreshTasks();
        setIsTransitioning(false);
      }, 600);
      
    } catch (error) {
      console.error("Failed to update status", error);
      setIsUpdating(false);
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      refreshTasks();
    } catch (error) {
      console.error("Failed to delete task", error);
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const getCategoryStyle = (category) => {
    switch (category?.toLowerCase()) {
      case 'exam': return 'text-red-700 bg-red-50/80 border-red-200';
      case 'project': return 'text-blue-700 bg-blue-50/80 border-blue-200';
      case 'assignment': return 'text-indigo-700 bg-indigo-50/80 border-indigo-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const dateString = task.due_date.endsWith('Z') ? task.due_date : `${task.due_date}Z`;
  const taskDate = new Date(dateString);
  
  const formattedDate = taskDate.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit'
  });

  // Use localStatus instead of task.status for immediate visual feedback
  const isCompleted = localStatus === 'completed';
  const isOverdue = taskDate < new Date() && !isCompleted;

  return (
    <>
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 group ${
        isTransitioning ? 'opacity-50 scale-[0.98]' : '' // Slight shrink effect before it disappears
      } ${
        isCompleted || isPrevious 
          ? 'bg-gray-50/80 border-gray-100 opacity-80' 
          : 'bg-white border-gray-200 shadow-sm hover:shadow hover:border-blue-200'
      }`}>
        <div className="flex items-start gap-3 sm:gap-4">
          
          {/* Status Toggle */}
          <button 
            onClick={handleStatusChange} 
            disabled={isUpdating || isTransitioning}
            className={`mt-1 focus:outline-none transition-transform shrink-0 ${
              isUpdating || isTransitioning ? 'cursor-default' : 'active:scale-95'
            }`}
          >
            {isUpdating ? (
              <Loader2 className="text-blue-500 animate-spin" size={24} strokeWidth={2.5} />
            ) : isCompleted ? (
              <CheckCircle className="text-green-500 transition-colors" size={24} strokeWidth={2.5} />
            ) : (
              <Circle className="text-gray-300 hover:text-blue-500 transition-colors" size={24} strokeWidth={2.5} />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {task.category && (
                <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getCategoryStyle(task.category)}`}>
                  {task.category}
                </span>
              )}
              
              {task.due_date && (
                <span className={`flex items-center text-xs font-semibold ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                  <Clock size={12} className="mr-1 shrink-0" />
                  <span className="truncate">{formattedDate}</span>
                </span>
              )}
            </div>
            
            <h3 className={`text-base sm:text-lg font-bold leading-tight transition-colors duration-300 ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className={`mt-1 text-sm line-clamp-2 transition-colors duration-300 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                {task.description}
              </p>
            )}
          </div>

          {/* Delete Button */}
          <button 
            onClick={() => setShowConfirm(true)} 
            className="text-gray-300 hover:text-red-500 focus:outline-none p-2 rounded-xl hover:bg-red-50 transition-all shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-gray-900/40 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-600" size={24} strokeWidth={2.5} />
              </div>
              <div className="pt-1">
                <h3 className="text-lg font-extrabold text-gray-900">Delete Reminder</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  Are you sure you want to delete this? It will be gone forever.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isDeleting && <Loader2 className="animate-spin" size={18} />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}