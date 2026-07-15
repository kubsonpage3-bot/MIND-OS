import { Info, Book, MessageSquare, ExternalLink, Shield, Zap, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

const APP_VERSION = "1.1.9";
const BUILD_DATE = "2026-07-06";

function getPlatform() {
  if (window.matchMedia("(display-mode: standalone)").matches) return "PWA (Installed)";
  if (navigator.userAgent.includes("Android")) return "Android";
  if (navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")) return "iOS";
  return "Web Browser";
}

export default function AboutPanel() {
  const { t } = useTranslation();
  const platform = getPlatform();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('about.header')}</span>
      </div>

      {/* App Info */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-bold text-foreground">MIND OS</span>
        </div>
        <div className="space-y-1 text-[10px] font-mono text-muted-foreground">
          <div>{t('about.version')} <span className="text-foreground">{APP_VERSION}</span></div>
          <div>{t('about.build')} <span className="text-foreground">{BUILD_DATE}</span></div>
          <div>{t('about.platform')} <span className="text-foreground">{platform}</span></div>
        </div>
      </div>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)]"
      >
        <p className="text-xs font-mono text-muted-foreground/80 leading-relaxed">
          {t('about.description')}
        </p>
      </motion.div>

      {/* Features */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] space-y-2">
        <div className="font-mono text-xs font-bold mb-2">{t('about.coreFeatures')}</div>
        <ul className="text-[10px] font-mono text-muted-foreground/70 space-y-1">
          <li>• {t('about.features.metrics')}</li>
          <li>• {t('about.features.tasks')}</li>
          <li>• {t('about.features.bosses')}</li>
          <li>• {t('about.features.character')}</li>
          <li>• {t('about.features.allies')}</li>
          <li>• {t('about.features.cloud')}</li>
          <li>• {t('about.features.pomodoro')}</li>
        </ul>
      </div>

      {/* Links */}
      <div className="space-y-2">
        <a
          href="#"
          className="w-full p-3 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Book className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">{t('about.links.documentation')}</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>

        <a
          href="mailto:kubsonpage3@gmail.com"
          className="w-full p-3 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">{t('about.links.feedback')}</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>

        <a
          href="https://mindos.pages.dev/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full p-3 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">{t('about.links.privacy')}</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>

        <a
          href="https://mindos.pages.dev/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full p-3 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)] hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">{t('about.links.terms')}</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
      </div>

      {/* Support */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)]">
        <p className="text-[10px] font-mono text-muted-foreground/60 leading-relaxed text-center">
          {t('about.support1')}<br />
          {t('about.support2')}
        </p>
      </div>

      {/* Credits */}
      <div className="p-4 rounded-xl border border-[var(--habit-border)] bg-[var(--habit-panel)]">
        <div className="text-[10px] font-mono text-muted-foreground/50 text-center">
          {t('about.builtWith')}
        </div>
      </div>
    </div>
  );
}