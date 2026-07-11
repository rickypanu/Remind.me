import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, Trash2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function TaskCard({ task, refreshTasks, isPrevious }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [localStatus, setLocalStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  // Modal UX: Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showConfirm) setShowConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showConfirm]);

  const handleStatusChange = async () => {
    if (isUpdating) return;
    setIsUpdating(true);
    
    const newStatus = localStatus === 'pending' ? 'completed' : 'pending';
    
    try {
      // 1. Immediately update UI for a snappy, smooth visual transition
      setLocalStatus(newStatus);
      
      // 2. Fire API call in the background
      await api.put(`/tasks/${task.id}?status=${newStatus}`);
      
      // 3. Wait slightly before refreshing the dashboard so the user enjoys the animation
      setTimeout(() => {
        refreshTasks();
        setIsUpdating(false);
      }, 700); 
      
    } catch (error) {
      console.error("Failed to update status", error);
      setLocalStatus(task.status); // Revert on failure
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

  // Logic for Dynamic Colors on Custom Categories
  const getDynamicColor = (text) => {
    const colors = [
      'text-teal-700 bg-teal-50 border-teal-200',
      'text-amber-700 bg-amber-50 border-amber-200',
      'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
      'text-emerald-700 bg-emerald-50 border-emerald-200',
      'text-rose-700 bg-rose-50 border-rose-200'
    ];
    // Create a simple hash from the string to pick a consistent color
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getCategoryStyle = (category) => {
    if (!category) return 'text-gray-600 bg-gray-100 border-gray-200';
    
    switch (category.toLowerCase()) {
      case 'exam / quiz': return 'text-red-700 bg-red-50 border-red-200';
      case 'project': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'assignment': return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'placement / internship': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'extracurricular': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'personal': return 'text-cyan-700 bg-cyan-50 border-cyan-200';
      default: return getDynamicColor(category); // Assigns a random but consistent color for "Other" inputs
    }
  };

  // Logic for Relative Time (e.g., "Due in 2 days", "Overdue by 3 hours")
  const getRelativeTime = (dateString) => {
    if (!dateString) return "";
    const taskDate = new Date(dateString.endsWith('Z') ? dateString : `${dateString}Z`);
    const now = new Date();
    const diffInMs = taskDate - now;
    
    const diffInMins = Math.round(diffInMs / 60000);
    const diffInHours = Math.round(diffInMins / 60);
    const diffInDays = Math.round(diffInHours / 24);

    if (diffInDays > 0) return `Due in ${diffInDays} day${diffInDays > 1 ? 's' : ''}`;
    if (diffInDays < 0) return `Overdue by ${Math.abs(diffInDays)} day${Math.abs(diffInDays) > 1 ? 's' : ''}`;
    if (diffInHours > 0) return `Due in ${diffInHours} hr${diffInHours > 1 ? 's' : ''}`;
    if (diffInHours < 0) return `Overdue by ${Math.abs(diffInHours)} hr${Math.abs(diffInHours) > 1 ? 's' : ''}`;
    if (diffInMins > 0) return `Due in ${diffInMins} min`;
    if (diffInMins < 0) return `Overdue by ${Math.abs(diffInMins)} min`;
    return 'Due now';
  };

  const relativeTimeString = getRelativeTime(task.due_date);
  const isCompleted = localStatus === 'completed';
  const isOverdue = relativeTimeString.includes('Overdue') && !isCompleted;

  return (
    <>
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-500 ease-out group relative overflow-hidden ${
        isCompleted || isPrevious 
          ? 'bg-gray-50/80 border-gray-100 opacity-60 scale-[0.98]' 
          : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300'
      }`}>
        <div className="flex items-start gap-3 sm:gap-4 relative z-10">
          
          {/* Status Toggle */}
          <button 
            aria-label={isCompleted ? "Mark task as pending" : "Mark task as completed"}
            onClick={handleStatusChange} 
            disabled={isUpdating}
            className="mt-1 focus:outline-none shrink-0 transition-transform active:scale-90"
          >
            {isUpdating ? (
              <Loader2 className="text-blue-500 animate-spin" size={24} strokeWidth={2.5} />
            ) : isCompleted ? (
              <CheckCircle className="text-green-500 transition-all duration-500 scale-110" size={24} strokeWidth={2.5} />
            ) : (
              <Circle className="text-gray-300 hover:text-blue-500 hover:scale-110 transition-all duration-300" size={24} strokeWidth={2.5} />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5 transition-opacity duration-500">
              {task.category && (
                <span className={`text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider transition-colors duration-500 ${
                  isCompleted ? 'bg-gray-100 text-gray-400 border-gray-200' : getCategoryStyle(task.category)
                }`}>
                  {task.category}
                </span>
              )}
              
              {task.due_date && (
                <span className={`flex items-center text-xs font-semibold transition-colors duration-500 ${
                  isCompleted ? 'text-gray-400' : isOverdue ? 'text-red-500 font-bold' : 'text-gray-500'
                }`}>
                  <Clock size={12} className="mr-1 shrink-0" />
                  <span className="truncate">{relativeTimeString}</span>
                </span>
              )}
            </div>
            
            {/* Smooth line-through animation for title */}
            <h3 className={`text-base sm:text-lg font-bold leading-tight relative inline-block transition-colors duration-500 ${
              isCompleted ? 'text-gray-400' : 'text-gray-900'
            }`}>
              {task.title}
              <span className={`absolute left-0 top-1/2 h-[2px] bg-gray-400 transition-all duration-500 ease-out ${
                isCompleted ? 'w-full opacity-100' : 'w-0 opacity-0'
              }`}></span>
            </h3>
            
            {task.description && (
              <p className={`mt-1 text-sm line-clamp-2 transition-colors duration-500 ${
                isCompleted ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {task.description}
              </p>
            )}
          </div>

          {/* Delete Button */}
          <button 
            aria-label="Delete task"
            onClick={() => setShowConfirm(true)} 
            className="text-gray-300 hover:text-red-500 focus:outline-none p-2 rounded-xl hover:bg-red-50 transition-all shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showConfirm && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-gray-900/40 backdrop-blur-sm transition-opacity"
          onClick={() => setShowConfirm(false)} // Close on backdrop click
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
          >
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