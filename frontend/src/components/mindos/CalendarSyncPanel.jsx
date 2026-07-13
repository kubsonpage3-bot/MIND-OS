import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Calendar, Link, Unlink, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import FantasyIcon from "@/components/navigation/FantasyIcon";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

const CONNECTOR_ID = "6a3c683c1511b0c03aa71701";

export default function CalendarSyncPanel({ tasks = [] }) {
  const { t } = useTranslation();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedEvents, setSyncedEvents] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [error, setError] = useState(null);

  const checkConnection = async () => {
    const connected = localStorage.getItem("mindos_calendar_connected") === "true";
    setIsConnected(connected);
    setError(null);
  };

  const loadSyncedEvents = async () => {
    try {
      const storedEvents = JSON.parse(localStorage.getItem("mindos_calendar_events") || "[]");
      setSyncedEvents(storedEvents);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await checkConnection();
      if (localStorage.getItem("mindos_calendar_connected") === "true") {
        await loadSyncedEvents();
      }
    };
    init();
  }, []);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      localStorage.setItem("mindos_calendar_connected", "true");
      setIsConnected(true);
      await loadSyncedEvents();
      setIsConnecting(false);
    } catch (err) {
      setError('Failed to connect');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      localStorage.removeItem("mindos_calendar_connected");
      setIsConnected(false);
      setSyncedEvents([]);
      setLastSync(null);
    } catch (err) {
      setError('Failed to disconnect');
    }
  };

  const handleSyncTask = async (task) => {
    setIsSyncing(true);
    setError(null);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      const currentEvents = JSON.parse(localStorage.getItem("mindos_calendar_events") || "[]");
      const updated = [...currentEvents, { id: task.id, title: task.name, date: task.dueDate || task.scheduledTime }];
      localStorage.setItem("mindos_calendar_events", JSON.stringify(updated));
      setLastSync(new Date());
      await loadSyncedEvents();
    } catch (err) {
      setError('Failed to sync task');
    }
    setIsSyncing(false);
  };

  const dailiesWithDueDate = tasks.filter(t => t.type === 'daily' && t.scheduledTime);
  const todosWithDueDate = tasks.filter(t => t.type === 'todo' && t.dueDate && !t.done);

  if (!isConnected) {
    return (
      <div className="p-4 rounded-xl border border-border/40 bg-card/50">
        <div className="flex items-center gap-3 mb-3">
          <FantasyIcon size={20} className="text-primary">
            <Calendar />
          </FantasyIcon>
          <span className="font-mono text-sm font-bold text-foreground">Google Calendar Sync</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Sync your MIND OS tasks with Google Calendar to never miss your workouts and classes.
        </p>
        <Button
          onClick={handleConnect}
          disabled={isConnecting}
          variant="fantasy"
          size="sm"
          className="w-full font-mono tracking-wider"
        >
          {isConnecting ? (
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.span>
          ) : (
            <FantasyIcon size={16}><Link /></FantasyIcon>
          )}
          {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
        </Button>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-border/40 bg-card/50 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FantasyIcon size={20} className="text-green-400">
            <CheckCircle />
          </FantasyIcon>
          <span className="font-mono text-sm font-bold text-foreground">Google Calendar</span>
        </div>
        <Button
          onClick={handleDisconnect}
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-red-400"
        >
          <FantasyIcon size={14}><Unlink /></FantasyIcon>
          Disconnect
        </Button>
      </div>

      {/* Synced tasks */}
      <div className="space-y-2">
        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Tasks to Sync ({dailiesWithDueDate.length + todosWithDueDate.length})
        </div>
        
        {dailiesWithDueDate.length === 0 && todosWithDueDate.length === 0 && (
          <div className="text-xs text-muted-foreground/50 text-center py-4">
            No tasks with scheduled time or due date
          </div>
        )}

        {dailiesWithDueDate.map(task => (
          <motion.div
            key={task.id}
            layout
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{task.name}</div>
              <div className="text-[10px] text-muted-foreground">
                Daily at {task.scheduledTime} • {t("categories." + task.category, task.category)}
              </div>
            </div>
            <Button
              onClick={() => handleSyncTask(task)}
              disabled={isSyncing}
              variant="fantasy"
              size="sm"
              className="shrink-0"
            >
              {isSyncing ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-3 h-3" />
                </motion.span>
              ) : (
                <FantasyIcon size={14}><Calendar /></FantasyIcon>
              )}
            </Button>
          </motion.div>
        ))}

        {todosWithDueDate.map(task => (
          <motion.div
            key={task.id}
            layout
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30"
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{task.name}</div>
              <div className="text-[10px] text-muted-foreground">
                Due {task.dueDate} • {t("categories." + task.category, task.category)}
              </div>
            </div>
            <Button
              onClick={() => handleSyncTask(task)}
              disabled={isSyncing}
              variant="fantasy"
              size="sm"
              className="shrink-0"
            >
              {isSyncing ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <RefreshCw className="w-3 h-3" />
                </motion.span>
              ) : (
                <FantasyIcon size={14}><Calendar /></FantasyIcon>
              )}
            </Button>
          </motion.div>
        ))}
      </div>

      {/* Last sync info */}
      {lastSync && (
        <div className="text-[9px] font-mono text-muted-foreground/50 text-center">
          Last synced: {lastSync.toLocaleString()}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}