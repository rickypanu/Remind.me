import React, { useState } from 'react';
import { CheckCircle, Circle, Trash2, Clock, AlertTriangle } from 'lucide-react';
import api from '../utils/api';

export default function TaskCard({ task, refreshTasks, isPrevious }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleStatusChange = async () => {
    try {
      const newStatus = task.status === 'pending' ? 'completed' : 'pending';
      await api.put(`/tasks/${task.id}?status=${newStatus}`);
      refreshTasks();
    } catch (error) {
      console.error("Failed to update status", error);
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

  // --- TIMEZONE FIX & OVERDUE LOGIC ---
  // Ensure the date string from Mongo is treated as UTC by appending 'Z' if missing
  const dateString = task.due_date.endsWith('Z') ? task.due_date : `${task.due_date}Z`;
  const taskDate = new Date(dateString);
  
  const formattedDate = taskDate.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', 
    hour: '2-digit', minute: '2-digit'
  });

  const isCompleted = task.status === 'completed';
  const isOverdue = taskDate < new Date() && !isCompleted;

  return (
    <>
      <div className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 group ${
        isCompleted || isPrevious 
          ? 'bg-gray-50/80 border-gray-100 opacity-80' 
          : 'bg-white border-gray-200 shadow-sm hover:shadow hover:border-blue-200'
      }`}>
        <div className="flex items-start gap-3 sm:gap-4">
          
          {/* Status Toggle */}
          <button 
            onClick={handleStatusChange} 
            className="mt-1 focus:outline-none transition-transform active:scale-95 shrink-0"
          >
            {isCompleted ? (
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
            
            <h3 className={`text-base sm:text-lg font-bold leading-tight ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className={`mt-1 text-sm line-clamp-2 ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                {task.description}
              </p>
            )}
          </div>

          {/* Delete Button (Subtle, reveals on hover for cleaner UI) */}
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
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 flex justify-center items-center"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}