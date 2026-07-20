// @ts-nocheck
import { getRankDisplayData } from "@/lib/rankEngine";
import { CLASSES } from "@/constants/rpgData";
import PixelCharacter from "@/components/mindos/PixelCharacter";
import { useTranslation } from "react-i18next";

export default function ShareCard({ profile }) {
  const { t } = useTranslation();
  const currentRankIdValue = profile?.rank_info?.current_id || "E";
  const currentRank = getRankDisplayData(currentRankIdValue, profile);

  const chosenClass = profile?.character_class && profile.character_class !== "Wanderer" 
    ? CLASSES[profile.character_class] 
    : CLASSES["Wanderer"];

  return (
    <div 
      className="relative font-game bg-[#0a0818] flex flex-col items-center justify-between p-[64px]" 
      style={{
        width: 1080,
        height: 1080,
        color: "#ffffff"
      }}
    >
      {/* Background Pixel Scanlines */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 4px, #ffffff 4px, #ffffff 6px)" }} 
      />

      {/* Main Content Area */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center z-10">
        
        {/* Bracket-framed Portrait */}
        <div className="relative p-[40px] flex items-center justify-center mb-6">
          {/* ⌐ ¬ style corner marks */}
          <div className="absolute top-0 left-0 w-[80px] h-[80px] border-t-[16px] border-l-[16px] border-white/60" />
          <div className="absolute top-0 right-0 w-[80px] h-[80px] border-t-[16px] border-r-[16px] border-white/60" />
          <div className="absolute bottom-0 left-0 w-[80px] h-[80px] border-b-[16px] border-l-[16px] border-white/60" />
          <div className="absolute bottom-0 right-0 w-[80px] h-[80px] border-b-[16px] border-r-[16px] border-white/60" />
          
          {/* Portrait Container */}
          <div className="w-[560px] h-[560px] flex items-center justify-center bg-black/40 rounded-3xl overflow-hidden border-[4px]" style={{ borderColor: `${currentRank.color}20`, boxShadow: `inset 0 0 100px ${currentRank.color}20` }}>
            <PixelCharacter rankId={currentRank.id} rankColor={currentRank.color} size={560} hideLabel={true} />
          </div>
        </div>

        {/* Class Title */}
        <div 
          className="text-[72px] font-black uppercase tracking-[0.1em] text-center whitespace-nowrap leading-none mt-4" 
          style={{ 
            color: chosenClass?.color || "#9944ff", 
            textShadow: `0 0 40px ${chosenClass?.color || "#9944ff"}` 
          }}
        >
          {chosenClass ? t(`classes.${chosenClass.id}`, chosenClass.name) : t("classes.ascetic", "THE ASCETIC")}
        </div>

        {/* Streak Title */}
        <div 
          className="text-[40px] font-bold tracking-widest text-center mt-6 text-slate-400 uppercase"
        >
          &lt; {profile?.streak_title || "The Forsaken"} &gt;
        </div>

      </div>

      {/* Bottom Rank Badge Pill */}
      <div 
        className="w-full h-[140px] rounded-[3rem] border-[6px] flex items-center justify-center z-10 shrink-0" 
        style={{ 
          backgroundColor: `${currentRank.color}10`, 
          borderColor: currentRank.color,
          boxShadow: `0 0 60px ${currentRank.color}30, inset 0 0 40px ${currentRank.color}20`
        }}
      >
        <div 
          className="text-[72px] font-black tracking-widest uppercase flex items-center justify-center h-full leading-[0]" 
          style={{ 
            color: currentRank.color, 
            textShadow: `0 0 40px ${currentRank.color}, 0 0 10px #ffffff` 
          }}
        >
          {currentRank.id} — {t(`ranks.${currentRank.id}`, currentRank.label)}
        </div>
      </div>

    </div>
  );
}
