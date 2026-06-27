import { Info, Book, MessageSquare, ExternalLink, Shield, Zap, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import CalendarConnectPanel from "@/components/mindos/CalendarConnectPanel";

const APP_VERSION = "1.0.0";
const BUILD_DATE = "2026-06-23";

export default function AboutPanel() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">About</span>
      </div>

      {/* App Info */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-mono text-sm font-bold text-foreground">MIND OS</span>
        </div>
        <div className="space-y-1 text-[10px] font-mono text-muted-foreground">
          <div>Version: <span className="text-foreground">{APP_VERSION}</span></div>
          <div>Build: <span className="text-foreground">{BUILD_DATE}</span></div>
          <div>Platform: <span className="text-foreground">Tauri (Desktop)</span></div>
        </div>
      </div>

      {/* Description */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl border border-border bg-card"
      >
        <p className="text-xs font-mono text-muted-foreground/80 leading-relaxed">
          MIND OS is a gamified productivity system that combines cognitive training with RPG mechanics.
          Track habits, complete daily tasks, defeat bosses, and level up your character while improving
          your real-life cognitive abilities.
        </p>
      </motion.div>

      {/* Features */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-2">
        <div className="font-mono text-xs font-bold mb-2">Core Features</div>
        <ul className="text-[10px] font-mono text-muted-foreground/70 space-y-1">
          <li>• Cognitive metric tracking (GF, GC, PS, VM)</li>
          <li>• Task management (Habits, Dailies, To-Dos)</li>
          <li>• Boss battles & rank progression</li>
          <li>• Character customization & skill trees</li>
          <li>• Ally system & achievements</li>
          <li>• Cloud sync across devices</li>
          <li>• Pomodoro timer & calendar</li>
        </ul>
      </div>

      {/* Google Calendar Integration */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">Google Calendar Sync</span>
        </div>
        <p className="text-xs font-mono text-muted-foreground/80 leading-relaxed mb-3">
          Connect your Google Calendar to sync MIND OS tasks and events automatically.
        </p>
        <CalendarConnectPanel />
      </div>

      {/* Links */}
      <div className="space-y-2">
        <a
          href="#"
          className="w-full p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Book className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">Documentation</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>

        <a
          href="#"
          className="w-full p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">Feedback & Bug Report</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>

        <a
          href="#"
          className="w-full p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <Shield className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-mono text-foreground">Privacy Policy</span>
          </div>
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        </a>
      </div>

      {/* Credits */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="text-[10px] font-mono text-muted-foreground/50 text-center">
          Built with ❤️ for MIND OS
        </div>
      </div>
    </div>
  );
}