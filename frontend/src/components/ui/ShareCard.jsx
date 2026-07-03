import { useMemo } from "react";
import { getRankDisplayData } from "@/lib/rankEngine";
import { CLASSES } from "@/constants/rpgData";
import PixelCharacter from "@/components/mindos/PixelCharacter";
import MasteryRadar from "@/components/mindos/MasteryRadar";

const SUBJECT_CATS = [
  { id: "body", label: "BODY", color: "#ff4400", icon: "💪", activities: ["exercise", "running", "cold_shower", "nutrition", "sleep"] },
  { id: "sciences", label: "SCIENCES", color: "#3b82f6", icon: "🔬", activities: ["mathematics", "physics", "chemistry", "biology", "computer_science", "coding"] },
  { id: "languages", label: "LANGUAGES", color: "#00cc88", icon: "🌐", activities: ["english", "german", "other_languages"] },
  { id: "spirit", label: "SPIRIT", color: "#9944ff", icon: "✨", activities: ["prayer_meditation", "prayer", "meditation", "mindfulness", "reading_philosophy"] },
  { id: "humanities", label: "HUMANITIES", color: "#f0c040", icon: "📚", activities: ["reading", "philosophy", "history", "humanities", "writing"] },
];

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

  return (
    <div 
      className="relative overflow-hidden font-inter" 
      style={{
        width: 1080,
        height: 1080,
        background: "radial-gradient(circle at 50% 50%, #1e1a38 0%, #0a0818 100%)",
        border: `8px solid ${currentRank.color}44`,
        color: "#ffffff"
      }}
    >
      {/* Background Pixel Scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 4px, #ffffff 4px, #ffffff 6px)" }} 
      />

      <div className="absolute inset-0 p-12 flex flex-col justify-between z-10">
        
        {/* Header: Name/Class & Rank Badge */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-8">
            <div className="shrink-0 rounded-3xl overflow-hidden border-4 bg-black/40 relative flex items-center justify-center" style={{ borderColor: currentRank.color, boxShadow: `0 0 30px ${currentRank.color}40`, width: 140, height: 140 }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={140} />
              </div>
            </div>
            <div className="flex flex-col justify-center mt-2">
              <div className="text-6xl font-black tracking-tight text-white mb-2">
                {profile?.user__username || "Agent"}
              </div>
              <div className="font-mono text-3xl uppercase tracking-widest" style={{ color: chosenClass?.color || "#3b82f6" }}>
                {chosenClass?.name || "Wanderer"}
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="font-mono text-2xl text-muted-foreground uppercase tracking-widest mb-2">Rank</div>
            <div 
              className="text-8xl font-black px-10 py-4 rounded-3xl"
              style={{ 
                color: currentRank.color, 
                background: `${currentRank.color}15`, 
                border: `4px solid ${currentRank.color}50`,
                textShadow: `0 0 40px ${currentRank.color}80`,
                boxShadow: `0 0 40px ${currentRank.color}20`
              }}
            >
              {currentRank.id}
            </div>
          </div>
        </div>

        {/* Center: Radar Chart */}
        <div className="flex-1 flex flex-col items-center justify-center py-4">
          <div className="font-mono text-2xl uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">Mastery Radar</div>
          <div className="w-[600px] h-[600px] relative">
            <MasteryRadar 
              subjectStats={subjectStats}
              outerRadius="55%"
              fontSize={18}
              dotRadius={10}
              showIcons={true}
            />
          </div>
        </div>

        {/* Footer: Stats & Logo */}
        <div className="flex justify-between items-end border-t-4 pt-10" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <div className="flex gap-16">
            <div className="space-y-3">
              <div className="font-mono text-2xl text-muted-foreground uppercase tracking-widest">Allies</div>
              <div className="text-5xl font-black text-white">{alliesCount} <span className="text-3xl text-white/40">/ 8</span></div>
            </div>
            <div className="space-y-3">
              <div className="font-mono text-2xl text-muted-foreground uppercase tracking-widest">Achievements</div>
              <div className="text-5xl font-black text-white">{achievementsCount}</div>
            </div>
          </div>
          
          <div className="text-right space-y-2">
            <div className="font-black text-4xl tracking-tighter text-white">MIND OS</div>
            <div className="font-mono text-2xl text-muted-foreground/60 tracking-widest">mindos.app</div>
          </div>
        </div>
        
      </div>
    </div>
  );
}
