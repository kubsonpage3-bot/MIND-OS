import { motion } from "framer-motion";
import GameCard from "./GameCard";
import { Brain, Sparkles, LayoutDashboard, CheckSquare, User, Shield, Loader2, RotateCcw } from "lucide-react";

export default function ServerWakeupSkeleton({ message, isLongWait, onRetry }) {
  // Common pulsing animation for skeleton blocks
  const pulseProps = {
    animate: { opacity: [0.3, 0.6, 0.3] },
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
  };

  return (
    <div className="fixed inset-0 flex flex-col md:flex-row h-dvh overflow-hidden bg-[#050508] text-[var(--habit-text)] select-none">
      
      {/* Mobile Top Nav Placeholder */}
      <div className="md:hidden h-12 border-b border-border/40 bg-card flex items-center justify-between px-4 shrink-0">
        <div className="w-6 h-6 rounded bg-muted/40" />
        <div className="flex gap-4">
          <div className="w-5 h-5 rounded bg-muted/40" />
          <div className="w-5 h-5 rounded bg-muted/40" />
        </div>
      </div>

      {/* Desktop Sidebar Placeholder */}
      <div className="hidden md:flex flex-col w-64 border-r border-border/40 bg-card/50 h-full p-4 shrink-0">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary/40" />
          </div>
          <div className="h-4 w-24 bg-primary/20 rounded" />
        </div>
        
        <div className="space-y-2 flex-1">
          {[LayoutDashboard, CheckSquare, User, Shield].map((Icon, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/5">
              <Icon className="w-4 h-4 text-muted-foreground/30" />
              <div className="h-3 w-20 bg-muted/20 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-8 flex flex-col h-full overflow-hidden relative">
        
        {/* Status Overlay */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#050508]/80 backdrop-blur-sm px-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center max-w-sm text-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
              <div className="w-16 h-16 rounded-2xl bg-card border border-primary/30 flex items-center justify-center relative">
                {isLongWait && onRetry ? (
                  <Brain className="w-8 h-8 text-destructive/60" />
                ) : (
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                )}
              </div>
            </div>
            
            <h2 className="font-mono text-lg font-bold mb-2 text-foreground">SYSTEM BOOT</h2>
            <p className="font-mono text-xs text-muted-foreground leading-relaxed mb-6">
              {message}
            </p>

            {isLongWait && onRetry && (
              <button 
                onClick={onRetry}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg text-xs font-mono font-bold hover:bg-muted/50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                RETRY CONNECTION
              </button>
            )}
          </motion.div>
        </div>

        {/* Header Placeholder */}
        <div className="flex items-center justify-between mb-8 opacity-40">
          <div>
            <div className="h-6 w-32 bg-muted/20 rounded mb-2" />
            <div className="h-3 w-48 bg-muted/10 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-muted/20" />
            <div className="w-10 h-10 rounded-full bg-muted/20" />
          </div>
        </div>

        {/* Dashboard Grid Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-40">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <GameCard key={i} className="h-32 flex flex-col justify-between" {...pulseProps}>
              <div className="flex justify-between items-start">
                <div className="h-3 w-24 bg-muted/20 rounded" />
                <div className="h-6 w-6 rounded bg-muted/10" />
              </div>
              <div className="space-y-2">
                <div className="h-2 w-full bg-muted/10 rounded" />
                <div className="h-2 w-2/3 bg-muted/10 rounded" />
              </div>
            </GameCard>
          ))}
        </div>
        
      </div>
    </div>
  );
}
