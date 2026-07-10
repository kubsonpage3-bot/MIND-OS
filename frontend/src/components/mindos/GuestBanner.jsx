import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function GuestBanner({ onConvertClick }) {
  const { profile } = useDjangoAuth();
  const { t } = useTranslation();

  if (!profile?.is_guest) return null;

  return (
    <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3 text-amber-500/90">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <div className="text-sm font-mono leading-tight">
          {t('guest.mode_banner')}
        </div>
      </div>
      
      <button 
        onClick={onConvertClick}
        className="ml-4 shrink-0 flex items-center space-x-2 text-xs font-mono font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 px-3 py-1.5 rounded transition-colors"
      >
        <span>{t('guest.create_account_btn')}</span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
