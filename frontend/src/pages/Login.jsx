import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, guestLogin } = useDjangoAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('mindos_session_expired') === 'true') {
      setError('Session expired. Please log in again.');
      sessionStorage.removeItem('mindos_session_expired');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await guestLogin();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Guest login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="flex min-h-screen flex-col items-center justify-center px-4 text-slate-100 relative overflow-hidden bg-cover bg-center select-none"
      style={{
        backgroundImage: "url('/images/space_pixel_bg.png')",
        imageRendering: "pixelated"
      }}
    >
      {/* Dark tint overlay */}
      <div className="absolute inset-0 bg-slate-950/60 pointer-events-none" />

      {/* CRT Scanline effect */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07] z-10"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #ffffff 2px, #ffffff 4px)" }} />

      <div className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-8 shadow-[0_0_40px_rgba(99,102,241,0.25)] backdrop-blur-md relative z-20">
        <div className="mb-8 text-center">
          {/* Logo with retro neon glow */}
          <h1 className="text-4xl font-extrabold tracking-widest text-white uppercase font-mono drop-shadow-[0_0_12px_rgba(99,102,241,0.8)]">
            MIND OS
          </h1>
          <p className="mt-2 text-xs font-mono tracking-wide text-slate-400 uppercase">
            Sign in to your neural workspace
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-mono uppercase tracking-wider text-slate-400">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value.trim())}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-white outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-mono uppercase tracking-wider text-slate-400">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-white outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-mono text-red-400">
              ⚡ {error}
            </p>
          )}

          <div className="flex flex-col space-y-3">
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 font-mono text-sm font-bold text-white hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.4)]"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : '► ACCESS CORE'}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleGuestLogin}
              className="flex w-full items-center justify-center rounded-lg border border-indigo-500/30 bg-slate-900/50 px-4 py-2.5 font-mono text-sm font-bold text-indigo-300 hover:bg-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer"
            >
              CONTINUE AS GUEST
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs font-mono text-slate-400 uppercase tracking-wide">
          New user?{' '}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-bold underline transition-colors">
            Register Account
          </Link>
        </p>
      </div>
    </div>
  );
}
