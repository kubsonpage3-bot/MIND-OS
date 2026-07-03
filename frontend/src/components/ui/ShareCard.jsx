import { useMemo } from "react";
import { getRankDisplayData } from "@/lib/rankEngine";
import { METRIC_CONFIG } from "@/lib/cognitiveEngine";
import { CLASSES, ACHIEVEMENTS } from "@/constants/rpgData";
import PixelCharacter from "@/components/mindos/PixelCharacter";
import MasteryRadar from "@/components/mindos/MasteryRadar";

const SUBJECT_CATS = [
  { id: "body", label: "BODY", color: "#ff4400", icon: "💪", activities: ["exercise", "running", "cold_shower", "nutrition", "sleep"] },
  { id: "sciences", label: "SCIENCES", color: "#3b82f6", icon: "🔬", activities: ["mathematics", "physics", "chemistry", "biology", "computer_science", "coding"] },
  { id: "languages", label: "LANGUAGES", color: "#00cc88", icon: "🌐", activities: ["english", "german", "other_languages"] },
  { id: "spirit", label: "SPIRIT", color: "#9944ff", icon: "✨", activities: ["prayer_meditation", "prayer", "meditation", "mindfulness", "reading_philosophy"] },
  { id: "humanities", label: "HUMANITIES", color: "#f0c040", icon: "📚", activities: ["reading", "philosophy", "history", "humanities", "writing"] },
];

function StatItem({ label, value, metricKey }) {
  const color = METRIC_CONFIG[metricKey]?.colorHex || "#ffffff";
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-2xl uppercase tracking-wider" style={{ color }}>{label}</span>
      <span className="text-4xl font-bold text-white">{Math.round(value)}</span>
    </div>
  );
}

export default function ShareCard({ profile, logs }) {
  const currentRankIdValue = profile?.rank_info?.current_id || "F";
  const currentRank = getRankDisplayData(currentRankIdValue);

  const chosenClass = profile?.character_class && profile.character_class !== "Wanderer" 
    ? CLASSES[profile.character_class] 
    : CLASSES["Wanderer"];

  // Compute subject stats for Radar
  const subjectStats = useMemo(() => {
    return SUBJECT_CATS.map(cat => {
      const catLogs = (logs || []).filter(l => cat.activities.includes(l.activity_key));
      const totalHours = catLogs.reduce((s, l) => s + (l.hours || 0), 0);
      const MASTERY = 500;
      const pct = Math.min(100, (totalHours / MASTERY) * 100);
      return { ...cat, totalHours, pct };
    });
  }, [logs]);

  const alliesCount = Object.keys(profile?.recruited_allies || {}).length;
  const achievementsCount = profile?.unlocked_achievements?.length || 0;
  const achievementsTotal = ACHIEVEMENTS.length;
  const username = profile?.username || profile?.user__username;

  return (
    <div 
      className="relative font-mono flex items-center justify-center p-8" 
      style={{
        width: 1080,
        height: 1080,
        background: "radial-gradient(circle at 50% 50%, #1e1a38 0%, #0a0818 100%)",
        color: "#ffffff"
      }}
    >
      {/* Background Pixel Scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 4px, #ffffff 4px, #ffffff 6px)" }} 
      />

      {/* Main Card Frame */}
      <div 
        className="relative w-full h-full rounded-[3rem] border-[4px] flex flex-col z-10 overflow-hidden"
        style={{ 
          borderColor: `${currentRank.color}40`,
          boxShadow: `inset 0 0 100px ${currentRank.color}15, 0 0 60px ${currentRank.color}20`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)"
        }}
      >
        {/* Header Region */}
        <div className="flex items-center justify-between p-12 border-b-2" style={{ borderColor: `${currentRank.color}20` }}>
          {/* Left: Avatar + Details */}
          <div className="flex items-center gap-12">
            <div className="shrink-0 rounded-[3rem] overflow-hidden border-[4px] bg-black/60 relative flex items-center justify-center" 
                 style={{ borderColor: "rgba(255,255,255,0.15)", width: 240, height: 240 }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={240} />
              </div>
            </div>
            
            <div className="flex flex-col justify-center">
              {username && (
                <div className="text-[72px] font-black tracking-tight text-white mb-2 leading-none">
                  {username}
                </div>
              )}
              <div className="text-[40px] uppercase tracking-widest" style={{ color: chosenClass?.color || "#3b82f6" }}>
                {chosenClass?.name || "Wanderer"}
              </div>
            </div>
          </div>
          
          {/* Right: Integrated Rank Badge */}
          <div className="flex flex-col items-center justify-center rounded-[2rem] px-12 py-6 border-[3px]"
               style={{ 
                 borderColor: `${currentRank.color}60`,
                 background: `linear-gradient(135deg, ${currentRank.color}15, transparent)`,
                 boxShadow: `0 0 40px ${currentRank.color}20`
               }}>
            <div className="text-2xl text-muted-foreground uppercase tracking-[0.3em] mb-2">Rank</div>
            <div className="text-[100px] font-black flex items-center justify-center leading-tight" style={{ color: currentRank.color, textShadow: `0 0 40px ${currentRank.color}` }}>
              {currentRank.id}
            </div>
          </div>
        </div>

        {/* Center: The Radar (Dominant) */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden">
           
           {/* Scaled-up Radar */}
           <div className="w-[850px] h-[850px] relative z-10 flex items-center justify-center">
             <MasteryRadar 
               subjectStats={subjectStats}
               outerRadius="60%"
               fontSize={24}
               dotRadius={12}
               showIcons={true}
               strokeColor={currentRank.color}
               fillColor={currentRank.color}
               fillOpacity={0.15}
             />
           </div>
           
           {/* Compact Stat Row Overlay */}
           <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
             <div className="flex gap-10 px-12 py-4 rounded-full border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl">
                <StatItem label="Gf" metricKey="gf" value={profile?.gf || 100} />
                <StatItem label="Gc" metricKey="gc" value={profile?.gc || 100} />
                <StatItem label="Ps" metricKey="ps" value={profile?.ps || 100} />
                <StatItem label="Vm" metricKey="vm" value={profile?.vm || 100} />
             </div>
           </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-12 py-10 border-t-2 bg-black/20" style={{ borderColor: `${currentRank.color}20` }}>
          <div className="flex gap-16">
            <div>
              <div className="text-xl text-muted-foreground/80 uppercase tracking-widest mb-2">Allies</div>
              <div className="text-4xl font-black text-white">{alliesCount} <span className="text-2xl text-white/40">/ 8</span></div>
            </div>
            <div>
              <div className="text-xl text-muted-foreground/80 uppercase tracking-widest mb-2">Achievements</div>
              <div className="text-4xl font-black text-white">{achievementsCount} <span className="text-2xl text-white/40">/ {achievementsTotal}</span></div>
            </div>
          </div>
          
          <div className="text-right flex items-center gap-6">
            <span className="text-5xl filter brightness-150">⚡</span>
            <div className="text-left">
              <div className="text-2xl text-muted-foreground/60 tracking-widest uppercase">mindos.app</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
