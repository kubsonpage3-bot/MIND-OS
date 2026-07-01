import { useState } from "react";
import { Shield, Eye, UserX, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export default function PrivacyPanel() {
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
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Privacy Settings</span>
      </div>

      {/* Rival Visibility */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Rival Visibility</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Allow your rival to see your progress</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">Visible to rival</span>
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
          <span className="font-mono text-xs font-bold">Anonymous Mode</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Hide your name from public leaderboards</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">Anonymous mode</span>
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
          <span className="font-mono text-xs font-bold">Analytics</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Allow anonymous usage analytics</p>
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-muted-foreground">Enable analytics</span>
          <button
            onClick={() => updateSetting("analyticsEnabled", privacy.analyticsEnabled !== false)}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-all ${
              privacy.analyticsEnabled !== false
                ? "border-green-500/40 bg-green-500/10 text-green-400"
                : "border-border/40 text-muted-foreground"
            }`}
          >
            {privacy.analyticsEnabled !== false ? "ON" : "OFF"}
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
          <p>Data collected:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Task completion history</li>
            <li>Cognitive metric progress</li>
            <li>Session duration and focus ratings</li>
            <li>Device type (for sync optimization)</li>
          </ul>
          <p className="mt-3">Data is stored securely and never shared with third parties.</p>
        </div>
      </motion.div>
    </div>
  );
}