import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Trash2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../utils/api';

export default function TaskCard({ task, refreshTasks, isPrevious }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [localStatus, setLocalStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);
  
  const timeoutRef = useRef(null);

  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  // Clean up any pending refresh timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

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
      
      // 2. Fire API call in the background (UPDATED TO PATCH)
      await api.patch(`/tasks/${task.id}`, { status: newStatus });
      
      // 3. Wait 500ms so the user enjoys the checkmark animation before it moves
      timeoutRef.current = setTimeout(() => {
        refreshTasks();
        setIsUpdating(false);
      }, 500); 
      
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
    if (!text) return 'text-slate-600 bg-slate-100 border-slate-200';
    const colors = [
      'text-teal-700 bg-teal-50 border-teal-200',
      'text-amber-700 bg-amber-50 border-amber-200',
      'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
      'text-emerald-700 bg-emerald-50 border-emerald-200',
      'text-rose-700 bg-rose-50 border-rose-200'
    ];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getCategoryStyle = (category) => {
    if (!category) return 'text-slate-600 bg-slate-100 border-slate-200';
    
    switch (category.toLowerCase()) {
      case 'exam / quiz': return 'text-rose-700 bg-rose-50 border-rose-200';
      case 'project': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'assignment': return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      case 'placement / internship': return 'text-purple-700 bg-purple-50 border-purple-200';
      case 'extracurricular': return 'text-orange-700 bg-orange-50 border-orange-200';
      case 'personal': return 'text-cyan-700 bg-cyan-50 border-cyan-200';
      default: return getDynamicColor(category);
    }
  };

  // Logic for Relative Time
  const getRelativeTime = (dateString) => {
    if (!dateString) return "";
    
    const str = String(dateString);
    const taskDate = new Date(str.endsWith('Z') ? str : `${str}Z`);
    
    if (isNaN(taskDate.getTime())) return "";

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
      <div className={`p-4 sm:p-5 rounded-[24px] border transition-all duration-500 ease-out group relative overflow-hidden ${
        isCompleted || isPrevious 
          ? 'bg-slate-50/60 border-slate-100 opacity-75 scale-[0.99] shadow-none' 
          : 'bg-white border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-md hover:border-blue-100'
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
              <CheckCircle2 className="text-emerald-500 transition-all duration-500 scale-110 drop-shadow-sm" size={24} strokeWidth={2.5} />
            ) : (
              <Circle className="text-slate-300 hover:text-blue-500 hover:scale-110 transition-all duration-300" size={24} strokeWidth={2.5} />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5 transition-opacity duration-500">
              {task.category && (
                <span className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider transition-colors duration-500 ${
                  isCompleted ? 'bg-slate-100 text-slate-400 border-slate-200' : getCategoryStyle(task.category)
                }`}>
                  {task.category}
                </span>
              )}
              
              {task.due_date && relativeTimeString && (
                <span className={`flex items-center text-xs font-bold transition-colors duration-500 ${
                  isCompleted ? 'text-slate-400' : isOverdue ? 'text-rose-500' : 'text-slate-500'
                }`}>
                  <Clock size={12} className="mr-1.5 shrink-0" strokeWidth={2.5} />
                  <span className="truncate">{relativeTimeString}</span>
                </span>
              )}
            </div>
            
            {/* Clean Title - No Strikethrough Line */}
            <h3 className={`text-base sm:text-lg font-bold leading-tight transition-colors duration-500 ${
              isCompleted ? 'text-slate-400' : 'text-slate-900'
            }`}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className={`mt-1.5 text-[13px] sm:text-sm font-medium line-clamp-2 transition-colors duration-500 ${
                isCompleted ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {task.description}
              </p>
            )}
          </div>

          {/* Delete Button */}
          <button 
            aria-label="Delete task"
            onClick={() => setShowConfirm(true)} 
            className="text-slate-300 hover:text-red-500 focus:outline-none p-2 rounded-xl hover:bg-red-50 transition-all shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <Trash2 size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showConfirm && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/30 backdrop-blur-sm transition-opacity"
          onClick={() => setShowConfirm(false)}
        >
          <div 
            className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm p-6 sm:p-8 transform transition-all animate-in zoom-in-95 duration-200 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600" size={26} strokeWidth={2.5} />
            </div>
            
            <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Reminder?</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
              Are you sure you want to delete "<span className="font-semibold text-slate-700">{task.title}</span>"? This action cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isDeleting && <Loader2 className="animate-spin" size={16} strokeWidth={3} />}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}