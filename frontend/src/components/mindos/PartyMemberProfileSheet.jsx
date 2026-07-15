import { useQuery } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import BottomSheet from '@/components/ui/BottomSheet';
import { getRankDisplayData } from '@/lib/rankEngine';
import { AllyPortrait } from './AlliesPanel';
import PixelCharacter from './PixelCharacter';
import { useHardwareBack } from '@/utils/modalStack';

export default function PartyMemberProfileSheet({ isOpen, onClose, userId, memberName }) {
  useHardwareBack(isOpen, onClose);
  
  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ['party-member-profile', userId],
    queryFn: () => djangoApi.party.memberProfile(userId),
    enabled: isOpen && !!userId,
  });

  const { data: ALLIES = [] } = useQuery({
    queryKey: ["allies-config"],
    queryFn: () => djangoApi.allies.getConfig(),
    enabled: isOpen,
  });

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`${memberName || 'Member'}'s Profile`}>
      {isLoading ? (
        <div className="py-8 text-center text-[11px] font-mono text-white/50">Loading profile...</div>
      ) : isError || !profile ? (
        <div className="py-8 text-center text-[11px] font-mono text-red-400">Failed to load profile.</div>
      ) : (
        <div className="space-y-6 pb-6">
          {/* Top section: Avatar & Basic Info */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {(() => {
                const rank = getRankDisplayData(profile.rank_info?.current_id || 'F', profile);
                return (
                  <div 
                    className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center shadow-lg relative"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${rank.color}18 0%, var(--habit-panel) 80%)`,
                      border: `2px solid ${rank.color}44`,
                      boxShadow: `0 4px 20px ${rank.color}18`,
                    }}
                  >
                    <PixelCharacter rankId={rank.id} rankColor={rank.color} size={72} hideLabel={true} />
                    <div className="absolute -bottom-2 bg-[var(--habit-purple)] text-white text-[10px] font-black font-mono px-2 py-0.5 rounded-lg border border-[var(--habit-purple-glow)] z-10 shadow-sm">
                      Lv.{profile.level}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div className="text-center mt-3">
              <div className="font-mono font-black text-lg text-[var(--habit-text)]">{profile.username}</div>
              <div className="text-xs font-mono text-[var(--habit-dim)]">{profile.character_class}</div>
            </div>
            
            {/* Rank badge */}
            {(() => {
              const rank = getRankDisplayData(profile.rank_info?.current_id || 'F', profile);
              return (
                <div 
                  className="mt-1 px-3 py-1 rounded font-mono font-bold text-xs border inline-block text-center shadow-sm"
                  style={{ background: rank.glow || `${rank.color}20`, color: rank.color, borderColor: `${rank.color}40` }}
                >
                  <div className="text-sm">{rank.id} {rank.god ? "👑" : ""}</div>
                  <div className="text-[8px] uppercase tracking-widest opacity-80">{rank.label}</div>
                </div>
              );
            })()}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[var(--habit-border)] text-center">
              <div className="text-[10px] font-mono text-[var(--habit-dim)] mb-1">Joined</div>
              <div className="font-mono text-xs font-bold text-[var(--habit-text)]">
                {profile.joined ? new Date(profile.joined).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[var(--habit-border)] text-center">
              <div className="text-[10px] font-mono text-[var(--habit-dim)] mb-1">Max Streak</div>
              <div className="font-mono text-xs font-bold text-[#f59e0b]">
                🔥 {profile.max_streak}d
              </div>
            </div>
            <div className="p-2 rounded-xl bg-[var(--habit-panel)] border border-[var(--habit-border)] text-center">
              <div className="text-[10px] font-mono text-[var(--habit-dim)] mb-1">Tasks Done</div>
              <div className="font-mono text-xs font-bold text-[#3b82f6]">
                ✓ {profile.total_tasks_completed}
              </div>
            </div>
          </div>

          {/* Core Bars */}
          <div className="space-y-3 p-3 rounded-xl bg-[var(--habit-panel)] border border-[var(--habit-border)]">
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-[#ef4444]">HP</span>
                <span className="text-[var(--habit-dim)]">{profile.hp} / {profile.max_hp}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--habit-border)] overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700 bg-[#ef4444]"
                  style={{ width: `${Math.min((profile.hp / Math.max(profile.max_hp, 1)) * 100, 100)}%`, boxShadow: '0 0 4px #ef444466' }}
                />
              </div>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-[#3b82f6]">Mana</span>
                <span className="text-[var(--habit-dim)]">{profile.mana} / {profile.max_mana}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--habit-border)] overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700 bg-[#3b82f6]"
                  style={{ width: `${Math.min((profile.mana / Math.max(profile.max_mana, 1)) * 100, 100)}%`, boxShadow: '0 0 4px #3b82f666' }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-[#a855f7]">Rank XP</span>
                <span className="text-[var(--habit-dim)]">{Math.floor(profile.rank_xp)} / {profile.rank_info?.next_threshold || profile.prestige_xp_required || 8000}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--habit-border)] overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-700 bg-[#a855f7]"
                  style={{ 
                    width: `${Math.min((profile.rank_xp / (profile.rank_info?.next_threshold || profile.prestige_xp_required || 8000)) * 100, 100)}%`,
                    boxShadow: '0 0 4px #a855f766' 
                  }}
                />
              </div>
            </div>
          </div>

          {/* Allies List */}
          <div>
            <div className="text-[11px] font-mono font-bold text-[var(--habit-dim)] mb-3 px-1 uppercase tracking-widest">
              Recruited Allies ({profile.allies?.length || 0})
            </div>
            
            {profile.allies?.length === 0 ? (
              <div className="p-4 rounded-xl border border-[var(--habit-border)] border-dashed text-center">
                <span className="text-xs font-mono text-white/30">No allies recruited yet</span>
              </div>
            ) : (
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ paddingRight: '1rem' }} onPointerDown={(e) => e.stopPropagation()}>
                {profile.allies.map(allyRef => {
                  const allyMeta = ALLIES.find(a => a.id === allyRef.ally_code);
                  if (!allyMeta) return null;
                  
                  return (
                    <div 
                      key={allyRef.ally_code}
                      className="shrink-0 w-24 p-2 rounded-xl border flex flex-col items-center gap-1.5"
                      style={{ 
                        background: 'var(--habit-panel)', 
                        borderColor: allyMeta.color || 'var(--habit-border)'
                      }}
                    >
                      <div className="scale-75 origin-top mb-[-12px] mt-1">
                        <AllyPortrait ally={allyMeta} isRecruited={true} />
                      </div>
                      <div className="text-center w-full">
                        <div className="font-mono text-[10px] font-bold truncate" style={{ color: allyMeta.color }}>
                          {allyMeta.name}
                        </div>
                        <div className="text-[8px] font-mono text-white/50 bg-black/20 rounded px-1 mt-0.5 inline-block">
                          Lv.{allyRef.level}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
