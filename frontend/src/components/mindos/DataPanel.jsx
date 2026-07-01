import { useState } from "react";
import { Database, Download, Upload, Cloud, CloudOff, RefreshCw, FileJson, Globe } from "lucide-react";
import { useDjangoAuth } from "@/lib/DjangoAuthContext";

export default function DataPanel() {
  const { profile } = useDjangoAuth();
  const [syncStatus, setSyncStatus] = useState("idle");
  const [lastSync, setLastSync] = useState(null);
  const [exportData, setExportData] = useState(null);
  const [importError, setImportError] = useState(null);

  const handleSyncToCloud = async () => {
    alert("Sync is now handled entirely by the backend.");
  };

  const handleSyncFromCloud = async () => {
    alert("Sync is now handled entirely by the backend.");
  };

  const exportAllData = () => {
    const data = {
      gameState: localStorage.getItem("mindos_game_state"),
      class: localStorage.getItem("mindos_class"),
      tasks: localStorage.getItem("mindos_tasks"),
      streak: localStorage.getItem("mindos_streak"),
      skillTree: localStorage.getItem("mindos_skill_tree"),
      allies: localStorage.getItem("mindos_allies"),
      mutators: localStorage.getItem("mindos_mutators"),
      prestige: localStorage.getItem("mindos_prestige"),
      scrolls: localStorage.getItem("mindos_scrolls"),
      hiddenActivities: localStorage.getItem("mindos_hidden_activities"),
      reminders: localStorage.getItem("mindos_reminders"),
      calendarEvents: localStorage.getItem("mindos_calendar_events"),
      settings: localStorage.getItem("mindos_settings"),
      notifications: localStorage.getItem("mindos_notifications"),
      gameplay: localStorage.getItem("mindos_gameplay_settings"),
      privacy: localStorage.getItem("mindos_privacy"),
    };
    setExportData(JSON.stringify(data, null, 2));
  };

  const downloadExport = () => {
    if (!exportData) return;
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindos-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== "string") return;
        const data = JSON.parse(result);
        Object.entries(data).forEach(([key, value]) => {
          if (value) localStorage.setItem(`mindos_${key}`, value);
        });
        setImportError(null);
        alert("Data imported successfully! Refreshing...");
        window.location.reload();
      } catch (err) {
        setImportError("Invalid backup file format");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-muted-foreground" />
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Data & Sync</span>
      </div>

      {/* Cloud Sync */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          {syncStatus === "syncing" ? (
            <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
          ) : syncStatus === "synced" ? (
            <Cloud className="w-3.5 h-3.5 text-green-400" />
          ) : syncStatus === "error" ? (
            <CloudOff className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <Cloud className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="font-mono text-xs font-bold">Cloud Sync Status</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Sync progress across all devices</p>
        <div className="flex gap-2">
          <button
            onClick={handleSyncToCloud}
            disabled={syncStatus === "syncing"}
            className="flex-1 py-2 rounded-lg border border-primary/40 text-primary font-mono text-xs hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Upload className="w-3 h-3" /> Upload
          </button>
          <button
            onClick={handleSyncFromCloud}
            disabled={syncStatus === "syncing"}
            className="flex-1 py-2 rounded-lg border border-primary/40 text-primary font-mono text-xs hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
        {lastSync && (
          <div className="text-[9px] font-mono text-muted-foreground/50 text-center">
            Last sync: {lastSync.toLocaleString()}
          </div>
        )}
        {syncStatus === "synced" && (
          <div className="text-[9px] font-mono text-green-400 text-center">✓ Synced</div>
        )}
        {syncStatus === "error" && (
          <div className="text-[9px] font-mono text-red-400 text-center">✗ Sync failed</div>
        )}
      </div>

      {/* Export */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <FileJson className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Export Data</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Download complete backup (JSON format)</p>
        <button
          onClick={exportAllData}
          className="w-full py-2 rounded-lg border border-primary/40 text-primary font-mono text-xs hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
        >
          <Download className="w-3 h-3" /> Generate Backup
        </button>
        {exportData && (
          <button
            onClick={downloadExport}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-mono text-xs hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Download className="w-3 h-3" /> Download File
          </button>
        )}
      </div>

      {/* Import */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Import Data</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">Restore from backup file</p>
        <label className="w-full py-2 rounded-lg border border-border text-muted-foreground font-mono text-xs hover:bg-accent transition-colors flex items-center justify-center gap-2 cursor-pointer">
          <Upload className="w-3 h-3" /> Select File
          <input type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        {importError && (
          <div className="text-[10px] text-red-400 font-mono text-center">{importError}</div>
        )}
      </div>

      {/* Storage Status */}
      <div className="p-4 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <Database className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Storage Status</span>
        </div>
        <div className="text-xs text-muted-foreground font-mono">
          {Object.keys(localStorage).filter(k => k.startsWith("mindos_")).length} mindos keys active
        </div>
      </div>

      {/* Timezone & Format */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-mono text-xs font-bold">Region Settings</span>
        </div>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground mb-1">Timezone</div>
            <div className="text-xs font-mono text-foreground">
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-muted-foreground mb-1">Date Format</div>
            <div className="flex gap-1">
              {["MM/dd/yyyy", "dd/MM/yyyy", "yyyy/MM/dd"].map(format => (
                <button
                  key={format}
                  className="flex-1 py-1.5 text-[10px] font-mono rounded border border-border/40 text-muted-foreground hover:border-border transition-all"
                >
                  {format}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}