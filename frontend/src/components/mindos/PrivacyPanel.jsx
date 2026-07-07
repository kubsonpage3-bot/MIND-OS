import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import { Shield, Eye, UserX, BarChart3, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { useMutation } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { queryClientInstance } from '@/lib/query-client';

export default function PrivacyPanel() {
  const { t } = useTranslation();
  const { profile } = useDjangoAuth();
  
  const updateProfile = useMutation({
    mutationFn: ({ data }) => djangoApi.profile.update(data),
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
    },
  });

  const [consent, setConsent] = useState(() => {
    return localStorage.getItem("mindos_consent_analytics") || "denied";
  });

  useEffect(() => {
    const handleUpdate = (e) => {
      setConsent(e.detail);
    };
    window.addEventListener("mindos_consent_updated", handleUpdate);
    return () => window.removeEventListener("mindos_consent_updated", handleUpdate);
  }, []);

  useEffect(() => {
    const localChoice = localStorage.getItem("mindos_consent_analytics");
    if (profile && localChoice) {
      const serverConsent = profile.analytics_enabled ? "granted" : "denied";
      if (localChoice !== serverConsent) {
        localStorage.setItem("mindos_consent_analytics", serverConsent);
        setConsent(serverConsent);
        if (typeof window.gtag === "function") {
          window.gtag("consent", "update", {
            "analytics_storage": serverConsent,
            "ad_storage": serverConsent,
            "ad_user_data": serverConsent,
            "ad_personalization": serverConsent
          });
        }
      }
    }
  }, [profile?.analytics_enabled]);

  const [privacy, setPrivacy] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mindos_privacy") || "{}");
    } catch {
      return {};
    }
  });

  const updateSetting = (key, value) => {
    const newSettings = { ...privacy, [key]: value };
    setPrivacy(newSettings);
    localStorage.setItem("mindos_privacy", JSON.stringify(newSettings));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{t('privacy.title')}</span>
      </div>

      {/* Rival Visibility */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('privacy.rivalVisibility')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('privacy.rivalDesc')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">{t('privacy.visibleLabel')}</span>
          <button
            onClick={() => updateSetting("rivalVisible", !privacy.rivalVisible)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              privacy.rivalVisible !== false
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {privacy.rivalVisible !== false ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Anonymous Mode */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <UserX className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('privacy.anonMode')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('privacy.anonDesc')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">{t('privacy.anonLabel')}</span>
          <button
            onClick={() => updateSetting("anonymous", !privacy.anonymous)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              privacy.anonymous
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {privacy.anonymous ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Analytics */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">{t('privacy.analytics')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{t('privacy.analyticsDesc')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">{t('privacy.analyticsLabel')}</span>
          <button
            onClick={() => {
              const nextConsent = consent === "granted" ? "denied" : "granted";
              localStorage.setItem("mindos_consent_analytics", nextConsent);
              setConsent(nextConsent);
              if (typeof window.gtag === "function") {
                window.gtag("consent", "update", {
                  "analytics_storage": nextConsent,
                  "ad_storage": nextConsent,
                  "ad_user_data": nextConsent,
                  "ad_personalization": nextConsent
                });
              }
              if (profile) {
                updateProfile.mutate({ 
                  data: { analytics_enabled: nextConsent === "granted" }
                });
              }
            }}
            disabled={updateProfile.isPending}
            className={`px-3 py-1.5 flex items-center justify-center min-w-[50px] text-xs font-mono rounded border transition-all ${
              consent === "granted"
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            } ${updateProfile.isPending ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {updateProfile.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (consent === "granted" ? "ON" : "OFF")}
          </button>
        </div>
      </div>

      {/* Data Usage */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl border border-border bg-card"
      >
        <div className="space-y-2 text-[10px] font-mono text-muted-foreground/70">
          <p>{t('privacy.dataCollected')}</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>{t('privacy.dataTaskHistory')}</li>
            <li>{t('privacy.dataMetricProgress')}</li>
            <li>{t('privacy.dataSessionInfo')}</li>
            <li>{t('privacy.dataDeviceType')}</li>
          </ul>
          <p className="mt-3">{t('privacy.dataSecureInfo')}</p>
        </div>
      </motion.div>
    </div>
  );
}