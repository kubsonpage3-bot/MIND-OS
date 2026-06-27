import { useState } from "react";
import { getXPPercent, getHPPercent, CLASSES, CLASS_ICONS, CLASS_BONUSES } from "@/lib/lifeOS";
import { Heart, Zap, ChevronDown, ChevronUp } from "lucide-react";

const STAT_LABELS = { str: { label: "STR", desc: "+Gold drops", color: "text-red-400" },
                       int: { label: "INT", desc: "+XP gains",   color: "text-blue-400" },
                       con: { label: "CON", desc: "-HP loss",    color: "text-green-400" },
                       per: { label: "PER", desc: "+Item drops", color: "text-yellow-400" } };

export default function CharacterPanel({ gs, update }) {
  const [expanded, setExpanded] = useState(false);
  const hpPct = getHPPercent(gs);
  const xpPct = getXPPercent(gs);
  const hpColor = hpPct > 60 ? "#22c55e" : hpPct > 30 ? "#eab308" : "#ef4444";

  const allocateStat = (stat) => {
    if (gs.statPoints <= 0) return;
    update(s => ({
      ...s,
      stats: { ...s.stats, [stat]: s.stats[stat] + 1 },
      statPoints: s.statPoints - 1,
    }));
  };

  const pickClass = (cls) => {
    const bonuses = CLASS_BONUSES[cls];
    update(s => ({
      ...s,
      charClass: cls,
      stats: {
        str: s.stats.str + (bonuses.str || 0),
        int: s.stats.int + (bonuses.int || 0),
        con: s.stats.con + (bonuses.con || 0),
        per: s.stats.per + (bonuses.per || 0),
      },
    }));
  };

  return (
    <div className="rounded-xl border border-purple-800/40 bg-purple-950/40 p-4">
      {/* Top row */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="text-4xl w-16 h-16 flex items-center justify-center rounded-xl border-2 border-purple-700/50 bg-purple-900/40 shrink-0">
          {gs.avatar}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-purple-100 text-sm">{gs.name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-700/50 text-purple-300">Lv {gs.level}</span>
            {gs.charClass && (
              <span className="text-xs px-2 py-0.5 rounded bg-purple-800/40 text-purple-400">
                {CLASS_ICONS[gs.charClass]} {gs.charClass}
              </span>
            )}
          </div>

          {/* HP bar */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] text-purple-500">
              <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" /> HP</span>
              <span>{gs.hp}/{gs.maxHp}</span>
            </div>
            <div className="h-2 bg-purple-900/60 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${hpPct}%`, backgroundColor: hpColor }} />
            </div>
          </div>

          {/* XP bar */}
          <div className="space-y-0.5">
            <div className="flex justify-between text-[10px] text-purple-500">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" /> XP</span>
              <span>{gs.xp}/{gs.level * 150}</span>
            </div>
            <div className="h-2 bg-purple-900/60 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </div>

        {/* Gold + toggle */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 text-yellow-400 font-bold text-sm">
            <span>🪙</span>
            <span>{gs.gold}</span>
          </div>
          {gs.statPoints > 0 && (
            <div className="text-[10px] px-2 py-0.5 rounded bg-yellow-600/20 border border-yellow-500/40 text-yellow-400 animate-pulse">
              {gs.statPoints} pts!
            </div>
          )}
          <button onClick={() => setExpanded(v => !v)} className="text-purple-500 hover:text-purple-300">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded stats panel */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-purple-800/40 space-y-3">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(STAT_LABELS).map(([sk, sc]) => (
              <button
                key={sk}
                onClick={() => allocateStat(sk)}
                disabled={gs.statPoints === 0}
                className={`p-2 rounded-lg border text-center transition-all ${
                  gs.statPoints > 0
                    ? "border-purple-600/60 bg-purple-800/30 hover:bg-purple-700/40 cursor-pointer"
                    : "border-purple-800/30 bg-purple-900/20"
                }`}
              >
                <div className={`font-bold text-sm ${sc.color}`}>{gs.stats[sk]}</div>
                <div className="text-[10px] text-purple-400 font-bold">{sc.label}</div>
                <div className="text-[9px] text-purple-600">{sc.desc}</div>
                {gs.statPoints > 0 && <div className="text-[9px] text-yellow-400 mt-0.5">+1 ▲</div>}
              </button>
            ))}
          </div>

          {/* Class picker (unlocks at lv 10) */}
          {gs.level >= 10 && !gs.charClass && (
            <div>
              <div className="text-xs text-purple-400 uppercase tracking-wider mb-2">Choose Class (Level 10 Unlocked!)</div>
              <div className="grid grid-cols-4 gap-2">
                {CLASSES.map(cls => (
                  <button key={cls} onClick={() => pickClass(cls)}
                    className="p-2 rounded-lg border border-purple-600/50 bg-purple-800/30 hover:bg-purple-700/40 text-center text-xs">
                    <div className="text-xl">{CLASS_ICONS[cls]}</div>
                    <div className="text-purple-200 font-bold mt-0.5">{cls}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Perfect day streak */}
          {gs.perfectDayStreak > 0 && (
            <div className="text-xs text-center text-yellow-400">
              🌟 Perfect Day Streak: {gs.perfectDayStreak} days
            </div>
          )}
        </div>
      )}
    </div>
  );
}