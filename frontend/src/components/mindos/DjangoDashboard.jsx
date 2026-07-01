import { useState, useEffect } from 'react';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { djangoApi } from '@/api/djangoClient';
import { 
  Heart, 
  Sparkles, 
  Coins, 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  AlertCircle, 
  Loader2 
} from 'lucide-react';

export default function DjangoDashboard() {
  const { profile, isAuthenticated, login, logout, refreshProfile, isLoading: authLoading } = useDjangoAuth();
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState(null);
  
  // Login form state
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [loginError, setLoginError] = useState(null);

  // New task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskType, setNewTaskType] = useState('todo');
  const [newTaskDifficulty, setNewTaskDifficulty] = useState('medium');

  // Load tasks on authentication
  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [isAuthenticated]);

  const fetchTasks = async () => {
    setLoadingTasks(true);
    setError(null);
    try {
      const data = await djangoApi.tasks.list();
      setTasks(Array.isArray(data) ? data : (data?.results || []));
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks from server.');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      await login(username, password);
    } catch (err) {
      setLoginError(err.message || 'Login failed. Make sure server is running and user exists.');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const created = await djangoApi.tasks.create({
        title: newTaskTitle,
        task_type: newTaskType,
        difficulty: newTaskDifficulty,
      });
      if (created) {
        setTasks((prev) => [created, ...(prev || [])]);
      }
      setNewTaskTitle('');
    } catch (err) {
      console.error('Failed to create task:', err);
      setError('Could not create task.');
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await djangoApi.tasks.complete(taskId, true);
      setTasks((prev) =>
        (prev || []).map((t) => (t.id === taskId ? { ...t, is_completed: true, completion_count: (t.completion_count || 0) + 1 } : t))
      );
      await refreshProfile();
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError('Could not update task completion.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await djangoApi.tasks.delete(taskId);
      setTasks((prev) => (prev || []).filter((t) => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
      setError('Could not delete task.');
    }
  };

  // Auth screen if not logged in
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">MIND OS</h1>
            <p className="mt-2 text-sm text-slate-400">Connect to your local Django Backend</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-white outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                required
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="flex w-full cursor-pointer items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Log In to Backend'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Guard Clause for Loading Profile/Task data initially
  if (!profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-indigo-400">
        <div className="relative flex flex-col items-center p-8 rounded-2xl border border-indigo-500/20 bg-slate-900/40 shadow-2xl backdrop-blur-xl">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
          <p className="font-semibold text-sm tracking-widest uppercase">Loading MIND OS Neural Link...</p>
        </div>
      </div>
    );
  }

  const hpVal = profile?.hp ?? 0;
  const hpMaxVal = profile?.hp_max ?? 100;
  const hpPct = Math.max(0, Math.min(100, hpMaxVal > 0 ? (hpVal / hpMaxVal) * 100 : 0));

  const mpVal = profile?.mana ?? 0;
  const mpMaxVal = profile?.mana_max ?? 100;
  const mpPct = Math.max(0, Math.min(100, mpMaxVal > 0 ? (mpVal / mpMaxVal) * 100 : 0));

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">MIND OS Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">Connected to local Django API</p>
          </div>
          <button
            onClick={logout}
            className="self-start cursor-pointer rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:outline-hidden"
          >
            Disconnect
          </button>
        </div>

        {/* Character Profile Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* HP Card */}
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold tracking-wider text-rose-400 uppercase">Hit Points</span>
              <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
            </div>
            <div className="text-2xl font-bold">{Math.round(hpVal)} / {hpMaxVal}</div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-rose-500 transition-all duration-300"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* MP Card */}
          <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold tracking-wider text-sky-400 uppercase">Mana</span>
              <Sparkles className="h-5 w-5 text-sky-500" />
            </div>
            <div className="text-2xl font-bold">{mpVal} / {mpMaxVal}</div>
            <div className="mt-3 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div 
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${mpPct}%` }}
              />
            </div>
          </div>

          {/* Gold / Level Card */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold tracking-wider text-amber-400 uppercase">Level & Gold</span>
              <Coins className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">Lvl {profile?.level ?? 1}</span>
              <span className="text-sm text-slate-400">({profile?.xp ?? 0}/{profile?.xp_to_next_level ?? 100} XP)</span>
            </div>
            <div className="mt-2 text-lg font-semibold text-amber-400">{profile?.gold ?? 0} Gold</div>
          </div>
        </div>

        {/* Task Section */}
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Create Task Form */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 md:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-white mb-4">Create Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  placeholder="E.g., Read for 30 minutes"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
                <select
                  value={newTaskType}
                  onChange={(e) => setNewTaskType(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <option value="habit">Habit</option>
                  <option value="daily">Daily</option>
                  <option value="todo">Todo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Difficulty</label>
                <select
                  value={newTaskDifficulty}
                  onChange={(e) => setNewTaskDifficulty(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-white outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <option value="trivial">Trivial</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-hidden"
              >
                <Plus className="h-4 w-4" /> Add Task
              </button>
            </form>
          </div>

          {/* Task List */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-6 md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Your Tasks</h2>
              <button 
                onClick={fetchTasks}
                className="cursor-pointer text-xs font-semibold text-indigo-400 hover:text-indigo-300 focus-visible:outline-hidden"
              >
                Refresh List
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {loadingTasks ? (
              <div className="flex py-12 justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : (tasks || []).length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                No tasks found. Create one to begin your adventure!
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {(tasks || []).map((task) => (
                  <div key={task?.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCompleteTask(task?.id)}
                        disabled={task?.is_completed}
                        className="cursor-pointer text-slate-400 hover:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-hidden"
                      >
                        {task?.is_completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </button>
                      
                      <div>
                        <span className={`text-sm font-medium ${task?.is_completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                          {task?.title}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {task?.task_type}
                          </span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {task?.difficulty}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteTask(task?.id)}
                      className="cursor-pointer text-slate-500 hover:text-rose-400 transition-colors focus-visible:outline-hidden"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

