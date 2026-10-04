import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Circle, Trash2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import { getRelativeTime } from '../../utils/date';

const getDynamicColor = (text) => {
  if (!text) return 'text-slate-600 bg-slate-100 border-slate-200';
  const colors = [
    'text-teal-700 bg-teal-50 border-teal-200',
    'text-amber-700 bg-amber-50 border-amber-200',
    'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200',
    'text-emerald-700 bg-emerald-50 border-emerald-200',
    'text-rose-700 bg-rose-50 border-rose-200',
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

export default function TaskCard({ task, refreshTasks, isPrevious }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [localStatus, setLocalStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);

  const timeoutRef = useRef(null);
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  // Clean up any pending refresh timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Modal: close on Escape, focus the safe button, lock background scroll
  useEffect(() => {
    if (!showConfirm) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) setShowConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    cancelBtnRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [showConfirm, isDeleting]);

  const handleStatusChange = async () => {
    if (isUpdating) return;
    setIsUpdating(true);

    const newStatus = localStatus === 'pending' ? 'completed' : 'pending';

    try {
      setLocalStatus(newStatus); // optimistic update
      await api.patch(`/tasks/${task.id}`, { status: newStatus });

      // Let the checkmark animation play before the card moves
      timeoutRef.current = setTimeout(() => {
        refreshTasks(
          newStatus === 'completed' ? 'Task marked complete!' : '↩️ Task moved to pending'
        );
        setIsUpdating(false);
      }, 500);
    } catch (error) {
      console.error('Failed to update status', error);
      setLocalStatus(task.status); // revert
      setIsUpdating(false);
      refreshTasks('❌ Could not update task. Try again.', 'error');
    }
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      refreshTasks('🗑️ Task deleted successfully!');
    } catch (error) {
      console.error('Failed to delete task', error);
      setIsDeleting(false);
      setShowConfirm(false);
      refreshTasks('❌ Could not delete task. Try again.', 'error');
    }
  };

  const relativeTimeString = getRelativeTime(task.due_date);
  const isCompleted = localStatus === 'completed';
  const isOverdue = relativeTimeString.startsWith('Overdue') && !isCompleted;
  const isHighPriority = String(task.priority || '').toLowerCase() === 'high' && !isCompleted;

  // Left accent: overdue (rose) > high priority (amber) > none
  const accent = isOverdue
    ? 'border-l-4 border-l-rose-400'
    : isHighPriority
    ? 'border-l-4 border-l-amber-400'
    : '';

  return (
    <>
      <div
        className={`p-4 sm:p-5 rounded-[24px] border transition-all duration-500 ease-out motion-reduce:transition-none group relative overflow-hidden ${accent} ${
          isCompleted || isPrevious
            ? 'bg-slate-50/60 border-slate-100 opacity-75 scale-[0.99] shadow-none'
            : 'bg-white border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-md hover:border-blue-100'
        }`}
      >
        <div className="flex items-start gap-3 sm:gap-4 relative z-10">
          {/* Status Toggle: padded to a ~40px touch target without shifting layout */}
          <button
            aria-label={isCompleted ? 'Mark task as pending' : 'Mark task as completed'}
            aria-pressed={isCompleted}
            onClick={handleStatusChange}
            disabled={isUpdating}
            className="-m-2 p-2 mt-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 shrink-0 transition-transform active:scale-90"
          >
            {isUpdating ? (
              <Loader2 className="text-blue-500 animate-spin" size={24} strokeWidth={2.5} />
            ) : isCompleted ? (
              <CheckCircle2
                className="text-emerald-500 transition-all duration-500 scale-110 drop-shadow-sm"
                size={24}
                strokeWidth={2.5}
              />
            ) : (
              <Circle
                className="text-slate-300 hover:text-blue-500 hover:scale-110 transition-all duration-300"
                size={24}
                strokeWidth={2.5}
              />
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              {task.category && (
                <span
                  className={`text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-md border uppercase tracking-wider transition-colors duration-500 ${
                    isCompleted
                      ? 'bg-slate-100 text-slate-400 border-slate-200'
                      : getCategoryStyle(task.category)
                  }`}
                >
                  {task.category}
                </span>
              )}

              {task.due_date && relativeTimeString && (
                <span
                  className={`flex items-center text-xs font-bold transition-colors duration-500 ${
                    isCompleted ? 'text-slate-400' : isOverdue ? 'text-rose-500' : 'text-slate-500'
                  }`}
                >
                  <Clock size={12} className="mr-1.5 shrink-0" strokeWidth={2.5} />
                  <span className="truncate">{relativeTimeString}</span>
                </span>
              )}
            </div>

            <h3
              className={`text-base sm:text-lg font-bold leading-tight transition-colors duration-500 ${
                isCompleted ? 'text-slate-400' : 'text-slate-900'
              }`}
            >
              {task.title}
            </h3>

            {task.description && (
              <p
                className={`mt-1.5 text-[13px] sm:text-sm font-medium line-clamp-2 transition-colors duration-500 ${
                  isCompleted ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {task.description}
              </p>
            )}
          </div>

          {/* Delete: always visible so it works on touch devices too */}
          <button
            aria-label={`Delete task: ${task.title}`}
            onClick={() => setShowConfirm(true)}
            className="text-slate-300 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 p-2.5 -mr-1 -mt-1 rounded-xl hover:bg-red-50 transition-all shrink-0"
          >
            <Trash2 size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-slate-900/30 backdrop-blur-sm"
          onClick={() => !isDeleting && setShowConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`delete-title-${task.id}`}
            aria-describedby={`delete-desc-${task.id}`}
            className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm p-6 sm:p-8 animate-in zoom-in-95 duration-200 motion-reduce:animate-none text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-600" size={26} strokeWidth={2.5} />
            </div>

            <h3 id={`delete-title-${task.id}`} className="text-xl font-bold text-slate-900 mb-2">
              Delete reminder?
            </h3>
            <p
              id={`delete-desc-${task.id}`}
              className="text-sm text-slate-500 font-medium leading-relaxed mb-6"
            >
              "<span className="font-semibold text-slate-700">{task.title}</span>" will be deleted
              permanently.
            </p>

            <div className="flex gap-3">
              <button
                ref={cancelBtnRef}
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
              >
                {isDeleting && <Loader2 className="animate-spin" size={16} strokeWidth={3} />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}