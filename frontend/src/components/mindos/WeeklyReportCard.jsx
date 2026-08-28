// @ts-nocheck
import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { djangoApi } from '@/api/djangoClient';
import { NUTRITION_TRENDS_KEY, NUTRITION_WEIGHT_KEY, NUTRI_GOAL_KEY } from '@/constants/queryKeys';
import { Share2, Download, X, Loader2, Trophy } from 'lucide-react';
import html2canvas from 'html2canvas';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(val, goal) {
  if (!goal || !val) return 0;
  return Math.min(100, Math.round((val / goal) * 100));
}

function MiniBar({ value, max, color }) {
  const p = pct(value, max);
  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${p}%`, background: color }}
      />
    </div>
  );
}

// ─── The printable card (rendered off-screen for canvas capture) ──────────────
function ReportCardContent({ forwardRef, trendsData, weightData, goalData, weekLabel }) {
  const avgCal = trendsData?.averages?.calories ?? 0;
  const avgProt = trendsData?.averages?.protein ?? 0;
  const avgFat = trendsData?.averages?.fat ?? 0;
  const avgCarbs = trendsData?.averages?.carbs ?? 0;
  const loggedDays = trendsData?.averages?.logged_days ?? 0;

  const goalCal = goalData?.calories ?? 2000;
  const goalProt = goalData?.protein ?? 150;
  const goalFat = goalData?.fat ?? 65;
  const goalCarbs = goalData?.carbs ?? 250;

  const weightSeries = weightData?.series ?? [];
  const targetWeight = weightData?.target_weight_kg ?? null;
  const firstW = weightSeries[0]?.weight_kg ?? null;
  const lastW = weightSeries[weightSeries.length - 1]?.weight_kg ?? null;
  const weightDelta = firstW && lastW ? (lastW - firstW).toFixed(1) : null;

  // How many days hit calorie goal (within ±10%)?
  const daysOnTarget = (trendsData?.daily_series ?? [])
    .filter(d => d.calories > 0 && Math.abs(d.calories - d.target_calories) <= d.target_calories * 0.1)
    .length;

  const MACROS = [
    { label: 'Calories', value: avgCal, goal: goalCal, unit: 'kcal', color: '#f59e0b' },
    { label: 'Protein',  value: avgProt, goal: goalProt, unit: 'g',   color: '#3b82f6' },
    { label: 'Fat',      value: avgFat,  goal: goalFat,  unit: 'g',   color: '#f97316' },
    { label: 'Carbs',    value: avgCarbs,goal: goalCarbs,unit: 'g',   color: '#10b981' },
  ];

  return (
    <div
      ref={forwardRef}
      style={{
        width: 360,
        background: 'linear-gradient(135deg, #0f0f17 0%, #1a1a2e 50%, #16213e 100%)',
        borderRadius: 24,
        padding: 28,
        fontFamily: "'Nunito', sans-serif",
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow orbs */}
      <div style={{
        position: 'absolute', top: -60, right: -60, width: 200, height: 200,
        borderRadius: '50%', background: 'rgba(245,158,11,0.08)', filter: 'blur(40px)',
      }} />
      <div style={{
        position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
        borderRadius: '50%', background: 'rgba(59,130,246,0.08)', filter: 'blur(40px)',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 2 }}>
            MIND OS · Nutrition
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.5px' }}>
            Weekly Report
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{weekLabel}</div>
        </div>
        <div style={{
          width: 48, height: 48, borderRadius: 16,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
        }}>
          🍽️
        </div>
      </div>

      {/* Days tracked badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: loggedDays >= 5 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.12)',
        border: `1px solid ${loggedDays >= 5 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.25)'}`,
        borderRadius: 999, padding: '4px 12px', marginBottom: 18,
        fontSize: 11, fontWeight: 800,
        color: loggedDays >= 5 ? '#10b981' : '#f59e0b',
      }}>
        {loggedDays >= 5 ? '🔥' : '📊'} {loggedDays}/7 days logged · {daysOnTarget} on-goal
      </div>

      {/* Macro averages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {MACROS.map(({ label, value, goal, unit, color }) => (
          <div key={label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>{label}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color }}>
                {Math.round(value)} <span style={{ fontSize: 10, opacity: 0.7 }}>{unit}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>/ {Math.round(goal)}</span>
              </span>
            </div>
            <div style={{ width: '100%', height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 999,
                width: `${Math.min(100, Math.round((value / goal) * 100))}%`,
                background: color,
                boxShadow: `0 0 8px ${color}60`,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 16 }} />

      {/* Weight & Goal row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        {lastW && (
          <div style={{
            flex: 1, padding: '10px 14px', borderRadius: 14,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>WEIGHT</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>{lastW} kg</div>
            {weightDelta !== null && (
              <div style={{ fontSize: 10, fontWeight: 700, color: parseFloat(weightDelta) <= 0 ? '#10b981' : '#f87171', marginTop: 1 }}>
                {parseFloat(weightDelta) > 0 ? '+' : ''}{weightDelta} kg / week
              </div>
            )}
          </div>
        )}
        {targetWeight && (
          <div style={{
            flex: 1, padding: '10px 14px', borderRadius: 14,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>GOAL</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b' }}>{targetWeight} kg</div>
            {lastW && targetWeight && (
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                {Math.abs(lastW - targetWeight).toFixed(1)} kg to go
              </div>
            )}
          </div>
        )}
        {!lastW && !targetWeight && (
          <div style={{
            flex: 1, padding: '10px 14px', borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>Track weight to see progress here</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
      }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>
          Generated by MIND OS
        </span>
        <span style={{ fontSize: 14 }}>⚔️🧠</span>
      </div>
    </div>
  );
}

// ─── Modal wrapper ─────────────────────────────────────────────────────────────
export default function WeeklyReportCard({ onClose }) {
  const { t } = useTranslation();
  const cardRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekLabel = `${monday.toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${today.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const { data: trendsData, isLoading: tLoading } = useQuery({
    queryKey: NUTRITION_TRENDS_KEY(7),
    queryFn: () => djangoApi.nutrition.getTrends(7),
    staleTime: 60_000,
  });

  const { data: weightData, isLoading: wLoading } = useQuery({
    queryKey: NUTRITION_WEIGHT_KEY(14),
    queryFn: () => djangoApi.nutrition.getWeight(14),
    staleTime: 60_000,
  });

  const { data: goalData } = useQuery({
    queryKey: NUTRI_GOAL_KEY,
    queryFn: () => djangoApi.nutrition.getGoal(),
    staleTime: 5 * 60_000,
  });

  const isLoading = tLoading || wLoading;

  async function handleExport() {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const url = canvas.toDataURL('image/png');
      setPreviewUrl(url);
    } catch (err) {
      console.error('html2canvas failed:', err);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleShare() {
    if (!previewUrl) {
      await handleExport();
      return;
    }
    try {
      // Convert dataURL → Blob → File
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      const file = new File([blob], 'mindos-weekly-report.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Weekly Nutrition Report — MIND OS',
          text: `🍽️ ${weekLabel} — Check my weekly nutrition stats!`,
          files: [file],
        });
      } else {
        // Fallback: plain download
        const a = document.createElement('a');
        a.href = previewUrl;
        a.download = 'mindos-weekly-report.png';
        a.click();
      }
    } catch (err) {
      if (err.name !== 'AbortError') console.error('Share failed:', err);
    }
  }

  function handleDownload() {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = 'mindos-weekly-report.png';
    a.click();
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full md:max-w-sm max-h-[95vh] overflow-y-auto"
        style={{
          background: 'var(--habit-panel)',
          border: '1px solid var(--habit-border)',
          borderRadius: '20px 20px 0 0',
          padding: 20,
          fontFamily: "'Nunito', sans-serif",
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy size={18} style={{ color: 'var(--habit-gold, #f59e0b)' }} />
            <span style={{ fontWeight: 900, fontSize: 17, color: 'var(--habit-text)' }}>
              Weekly Report
            </span>
          </div>
          <button onClick={onClose} className="text-2xl opacity-40 hover:opacity-100 transition-opacity">×</button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--habit-gold, #f59e0b)' }} />
            <span className="text-sm opacity-50">Loading your week…</span>
          </div>
        ) : (
          <>
            {/* Off-screen renderable card (always mounted for canvas capture) */}
            <div style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }}>
              <ReportCardContent
                forwardRef={cardRef}
                trendsData={trendsData}
                weightData={weightData}
                goalData={goalData}
                weekLabel={weekLabel}
              />
            </div>

            {/* Preview */}
            <div className="flex justify-center mb-4">
              {previewUrl ? (
                <motion.img
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={previewUrl}
                  alt="Weekly Report Preview"
                  className="rounded-2xl shadow-2xl"
                  style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }}
                />
              ) : (
                // Live preview (pre-render) — scaled down
                <div style={{ transform: 'scale(0.88)', transformOrigin: 'top center' }}>
                  <ReportCardContent
                    forwardRef={null}
                    trendsData={trendsData}
                    weightData={weightData}
                    goalData={goalData}
                    weekLabel={weekLabel}
                  />
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {!previewUrl ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#000',
                    cursor: 'pointer',
                    opacity: isExporting ? 0.7 : 1,
                  }}
                >
                  {isExporting ? (
                    <><Loader2 size={15} className="animate-spin" /> Rendering…</>
                  ) : (
                    <><Share2 size={15} /> Generate Card</>
                  )}
                </motion.button>
              ) : (
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleShare}
                    className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                    style={{
                      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                      color: '#000',
                      cursor: 'pointer',
                    }}
                  >
                    <Share2 size={14} /> Share
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDownload}
                    className="py-3 px-4 rounded-xl font-bold text-sm flex items-center gap-2"
                    style={{
                      background: 'var(--habit-border)',
                      color: 'var(--habit-text)',
                      cursor: 'pointer',
                    }}
                  >
                    <Download size={14} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setPreviewUrl(null)}
                    className="py-3 px-3 rounded-xl font-bold text-sm opacity-50 hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--habit-border)', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </motion.button>
                </div>
              )}

              <p className="text-center text-[10px] opacity-30 font-semibold">
                {previewUrl ? 'Tap Share to send via any app, or Download to save' : 'Tap Generate to render a shareable image card'}
              </p>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
