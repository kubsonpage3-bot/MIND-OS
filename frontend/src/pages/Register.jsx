import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { Loader2 } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useDjangoAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password !== password2) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await register(username, email, password, password2);
      navigate('/', { replace: true });
    } catch (err) {
      const msg =
        err.data?.password?.[0] ||
        err.data?.username?.[0] ||
        err.data?.email?.[0] ||
        err.message ||
        'Registration failed';
      setError(msg);
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
            Create your neural profile
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label htmlFor="email" className="mb-1 block text-xs font-mono uppercase tracking-wider text-slate-400">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-white outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
            />
          </div>

          <div>
            <label htmlFor="password2" className="mb-1 block text-xs font-mono uppercase tracking-wider text-slate-400">
              Confirm password
            </label>
            <input
              id="password2"
              type="password"
              autoComplete="new-password"
              required
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-white outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-all"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-mono text-red-400">
              ⚡ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 font-mono text-sm font-bold text-white hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-60 cursor-pointer shadow-[0_0_15px_rgba(99,102,241,0.4)]"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : '► INITIALIZE PROFILE'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs font-mono text-slate-400 uppercase tracking-wide">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold underline transition-colors">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
