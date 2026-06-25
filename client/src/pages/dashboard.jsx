import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, LogOut, LayoutDashboard, Loader2 } from 'lucide-react';
import api from '../utils/api';
import TaskCard from '../components/TaskCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'upcoming', 'previous'

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const response = await api.get('/tasks/');
      setTasks(response.data);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
      // If unauthorized, kick back to login
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  // --- Filtering Logic ---
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const todayTasks = tasks.filter(task => {
    const dueDate = new Date(task.due_date);
    return dueDate >= startOfToday && dueDate <= endOfToday && task.status === 'pending';
  });

  const upcomingTasks = tasks.filter(task => {
    const dueDate = new Date(task.due_date);
    return dueDate > endOfToday && task.status === 'pending';
  });

  const previousTasks = tasks.filter(task => {
    const dueDate = new Date(task.due_date);
    return dueDate < startOfToday || task.status === 'completed';
  });

  // Decide which array to map over based on active tab
  const displayedTasks = 
    activeTab === 'today' ? todayTasks : 
    activeTab === 'upcoming' ? upcomingTasks : previousTasks;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-blue-600" size={24} />
            <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">
              Remind<span className="text-blue-600">Me</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {/* Restored Link to navigate to the Create Task page */}
            <Link 
              to="/create-task"
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm hover:shadow-md"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">New Task</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 mt-8">
        
        {/* Custom Tab Navigation (Segmented Control style) */}
        <div className="flex space-x-2 bg-gray-200/50 p-1.5 rounded-xl mb-8 border border-gray-200">
          <button 
            onClick={() => setActiveTab('today')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex justify-center items-center gap-2 ${
              activeTab === 'today' 
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            Today 
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'today' ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-500'}`}>
              {todayTasks.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex justify-center items-center gap-2 ${
              activeTab === 'upcoming' 
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            Upcoming 
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'upcoming' ? 'bg-gray-100 text-gray-700' : 'bg-gray-200 text-gray-500'}`}>
              {upcomingTasks.length}
            </span>
          </button>
          <button 
            onClick={() => setActiveTab('previous')}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === 'previous' 
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200/50' 
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
            }`}
          >
            History
          </button>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-blue-600">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border-2 border-gray-200 border-dashed">
                <p className="text-gray-500 font-medium text-lg">No tasks found in this section.</p>
                {activeTab !== 'previous' && (
                  <p className="text-sm text-gray-400 mt-1">Time to relax or get ahead!</p>
                )}
              </div>
            ) : (
              displayedTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  refreshTasks={fetchTasks} 
                  isPrevious={activeTab === 'previous'}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}