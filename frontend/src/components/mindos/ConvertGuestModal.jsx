import { useState } from 'react';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { useTranslation } from 'react-i18next';
import { Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function ConvertGuestModal({ isOpen, onClose }) {
  const { convertGuest } = useDjangoAuth();
  const { t } = useTranslation();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setError(t('guest.passwords_no_match'));
      return;
    }

    setError(null);
    setLoading(true);
    
    try {
      await convertGuest(username, email, password, passwordConfirm);
      onClose();
    } catch (err) {
      setError(err.message || t('guest.failed_convert'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-xl overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-mono font-bold text-amber-500 uppercase tracking-widest">
                {t('guest.upgrade_title')}
              </h2>
              <button 
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm font-mono text-slate-300 mb-6 leading-relaxed">
                {t('guest.upgrade_desc')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase text-slate-400">{t('guest.username')}</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value.trim())}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-hidden focus:border-amber-500 font-mono transition-colors"
                  />
                </div>
                
                <div>
                  <label className="mb-1 block text-xs font-mono uppercase text-slate-400">{t('guest.email')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value.trim())}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-hidden focus:border-amber-500 font-mono transition-colors"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-mono uppercase text-slate-400">{t('guest.password')}</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-hidden focus:border-amber-500 font-mono transition-colors"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-mono uppercase text-slate-400">{t('guest.confirm_password')}</label>
                  <input
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={e => setPasswordConfirm(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-hidden focus:border-amber-500 font-mono transition-colors"
                  />
                </div>

                {error && (
                  <p className="text-xs font-mono text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center rounded-lg bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900 font-bold font-mono py-2.5 mt-2 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('guest.create_account_btn')}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
