import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Trash2, Pencil, Clock, Loader2, Repeat, CloudOff } from 'lucide-react';
import { getRelativeTime, formatDueIst } from '../../utils/date';
import { feedback } from '../../feedback/feedback';
import ConfirmDeleteDialog from '../../components/ConfirmDeleteDialog';
import EditReminderDialog from '../../components/EditReminderDialog';

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

export const getCategoryStyle = (category) => {
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

export default function TaskCard({ task, onToggle, onDelete, onEdit, isPrevious }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [localStatus, setLocalStatus] = useState(task.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  useEffect(() => {
    setLocalStatus(task.status);
  }, [task.status]);

  // Tap: the check animates and the sound / vibration fire at once; the list updates a beat later
  // (the change itself is saved locally first, so this works with no connection).
  const handleStatusChange = async (e) => {
    e.stopPropagation();
    if (isUpdating) return;
    const next = localStatus === 'pending' ? 'completed' : 'pending';
    setIsUpdating(true);
    setLocalStatus(next);
    setJustChecked(next === 'completed');
    if (next === 'completed') feedback.completed();
    else feedback.updated();

    await new Promise((r) => setTimeout(r, 380)); // let the checkmark play
    try {
      const result = await onToggle(task);
      setLocalStatus(result?.task?.status ?? next);
    } catch {
      setLocalStatus(task.status); // storage failed: revert
    } finally {
      setIsUpdating(false);
      setJustChecked(false);
    }
  };

  const relativeTimeString = getRelativeTime(task.due_date);
  const isRecurring = task.schedule_type === 'daily' || task.schedule_type === 'weekly';
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
        className={`rm-card-in p-4 sm:p-5 rounded-[24px] border transition-all duration-300 ease-out motion-reduce:transition-none group relative overflow-hidden ${accent} ${
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
            {isUpdating && !isCompleted ? (
              <Loader2 className="text-blue-500 animate-spin" size={24} strokeWidth={2.5} />
            ) : isCompleted ? (
              <CheckCircle2
                className={`text-emerald-500 drop-shadow-sm ${justChecked ? 'rm-pop' : 'scale-110'}`}
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

              {isRecurring && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-md border bg-blue-50 border-blue-200 text-blue-700 ${isCompleted ? 'opacity-60' : ''}`}
                >
                  <Repeat size={11} strokeWidth={2.75} aria-hidden="true" />
                  {task.schedule_label || (task.schedule_type === 'daily' ? 'Every day' : 'Every week')}
                </span>
              )}

              {task.due_date && relativeTimeString && (
                <span
                  className={`flex items-center text-xs font-bold transition-colors duration-500 ${
                    isCompleted ? 'text-slate-400' : isOverdue ? 'text-rose-500' : 'text-slate-500'
                  }`}
                >
                  <Clock size={12} className="mr-1.5 shrink-0" strokeWidth={2.5} />
                  <span className="min-w-0 break-words">{relativeTimeString} · {formatDueIst(task.due_date)} IST</span>
                </span>
              )}

              {task.needsSync && (
                <span
                  title="Saved on this device. It will upload when you're online."
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600"
                >
                  <CloudOff size={11} strokeWidth={2.5} aria-hidden="true" />
                  Not synced
                </span>
              )}
            </div>

            <h3
              className={`text-base sm:text-lg font-bold leading-tight break-words transition-colors duration-500 ${
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

          {/* Edit + Delete: always visible so they work on touch devices too */}
          <div className="flex shrink-0 items-center -mr-1 -mt-1">
            {onEdit && !isCompleted && (
              <button
                aria-label={`Edit task: ${task.title}`}
                title="Edit"
                onClick={() => setShowEdit(true)}
                className="text-slate-300 hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 p-2.5 rounded-xl hover:bg-blue-50 transition-all"
              >
                <Pencil size={17} strokeWidth={2.5} />
              </button>
            )}
            <button
              aria-label={`Delete task: ${task.title}`}
              title="Delete"
              onClick={() => setShowConfirm(true)}
              className="text-slate-300 hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 p-2.5 rounded-xl hover:bg-red-50 transition-all"
            >
              <Trash2 size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {showEdit && <EditReminderDialog task={task} onClose={() => setShowEdit(false)} onSave={onEdit} />}

      {showConfirm && (
        <ConfirmDeleteDialog
          task={task}
          isRecurring={isRecurring}
          onCancel={() => setShowConfirm(false)}
          onConfirm={async () => {
            await onDelete(task);
            setShowConfirm(false);
          }}
        />
      )}
    </>
  );
}
