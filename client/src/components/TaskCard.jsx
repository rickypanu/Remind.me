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

  const getCategoryColor = (category) => {
    switch (category.toLowerCase()) {
      case 'exam': return 'text-red-700 bg-red-50 border-red-200';
      case 'project': return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'assignment': return 'text-indigo-700 bg-indigo-50 border-indigo-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const isCompleted = task.status === 'completed';
  const formattedDate = new Date(task.due_date).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <>
      <div className={`p-5 rounded-2xl border transition-all duration-200 relative ${
        isCompleted || isPrevious 
          ? 'bg-gray-50 border-gray-200 opacity-75' 
          : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-blue-300'
      }`}>
        <div className="flex items-start justify-between gap-4">
          
          <button onClick={handleStatusChange} className="mt-1 focus:outline-none transition-transform hover:scale-110">
            {isCompleted ? (
              <CheckCircle className="text-green-500" size={24} />
            ) : (
              <Circle className="text-gray-300 hover:text-blue-600 transition-colors" size={24} />
            )}
          </button>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1.5">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border ${getCategoryColor(task.category)}`}>
                {task.category}
              </span>
              {task.due_date && (
                <span className="flex items-center text-xs font-medium text-gray-500">
                  <Clock size={12} className="mr-1" />
                  {formattedDate}
                </span>
              )}
            </div>
            
            <h3 className={`text-lg font-bold ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className={`mt-1.5 text-sm ${isCompleted ? 'text-gray-400' : 'text-gray-600'}`}>
                {task.description}
              </p>
            )}
          </div>

          <button 
            onClick={() => setShowConfirm(true)} 
            className="text-gray-400 hover:text-red-600 focus:outline-none p-2 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete Task</h3>
                <p className="text-sm text-gray-500 mt-1">Are you sure you want to delete this task? This cannot be undone.</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button 
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}