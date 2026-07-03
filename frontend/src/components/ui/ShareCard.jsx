import { useMemo } from "react";
import { getRankDisplayData } from "@/lib/rankEngine";
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
      className="relative font-game" 
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
        className="absolute inset-[40px] rounded-[3rem] border-[4px] flex flex-col z-10 p-[40px] overflow-hidden"
        style={{ 
          borderColor: `${currentRank.color}40`,
          boxShadow: `inset 0 0 100px ${currentRank.color}15, 0 0 60px ${currentRank.color}20`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)"
        }}
      >
        {/* HEADER ZONE: 200px */}
        <div className="w-full h-[200px] flex items-center justify-between border-b-[3px] pb-[40px]" style={{ borderColor: `${currentRank.color}20` }}>
          
          {/* Left: Avatar + Details */}
          <div className="flex items-center gap-12 h-full">
            <div className="shrink-0 w-[160px] h-[160px] rounded-[2rem] border-[4px] bg-black/60 relative flex items-center justify-center overflow-hidden" 
                 style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={200} />
              </div>
            </div>
            
            <div className="flex flex-col justify-center">
              {username && (
                <div className="text-[72px] font-black tracking-tight text-white leading-none mb-1">
                  {username}
                </div>
              )}
              <div className="text-[44px] uppercase tracking-widest leading-none mt-2" style={{ color: chosenClass?.color || "#3b82f6" }}>
                {chosenClass?.name || "Wanderer"}
              </div>
            </div>
          </div>
          
          {/* Right: Integrated Rank Badge */}
          <div className="flex flex-col items-center justify-center rounded-[2rem] w-[220px] h-[160px] border-[3px]"
               style={{ 
                 borderColor: `${currentRank.color}60`,
                 background: `linear-gradient(135deg, ${currentRank.color}15, transparent)`,
                 boxShadow: `0 0 40px ${currentRank.color}20`
               }}>
            <div className="text-3xl text-muted-foreground uppercase tracking-[0.3em] mb-1">Rank</div>
            {/* Using flex and precise line-height/padding to prevent clipping */}
            <div className="text-[120px] font-black flex items-center justify-center h-[90px] leading-[0]" style={{ color: currentRank.color, textShadow: `0 0 40px ${currentRank.color}` }}>
              {currentRank.id}
            </div>
          </div>
        </div>

        {/* RADAR ZONE: 560px */}
        <div className="w-full h-[560px] relative flex items-center justify-center">
           <div className="w-[600px] h-[600px] relative z-10 flex items-center justify-center">
             <MasteryRadar 
               subjectStats={subjectStats}
               outerRadius="55%"
               fontSize={32}
               dotRadius={12}
               showIcons={true}
               strokeColor={currentRank.color}
               fillColor={currentRank.color}
               fillOpacity={0.15}
             />
           </div>
        </div>

        {/* FOOTER ZONE: 160px */}
        <div className="w-full h-[160px] flex items-center justify-between border-t-[3px] pt-[40px]" style={{ borderColor: `${currentRank.color}20` }}>
          <div className="flex gap-16 items-center">
            <div>
              <div className="text-3xl text-muted-foreground/80 uppercase tracking-widest mb-2">Allies</div>
              <div className="text-6xl font-black text-white">{alliesCount} <span className="text-4xl text-white/40">/ 8</span></div>
            </div>
            <div>
              <div className="text-3xl text-muted-foreground/80 uppercase tracking-widest mb-2">Achievements</div>
              <div className="text-6xl font-black text-white">{achievementsCount} <span className="text-4xl text-white/40">/ {achievementsTotal}</span></div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <span className="text-7xl filter brightness-150">⚡</span>
            <div className="text-4xl text-muted-foreground/60 tracking-widest uppercase">mindos.app</div>
          </div>
        </div>

      </div>
    </div>
  );
}
