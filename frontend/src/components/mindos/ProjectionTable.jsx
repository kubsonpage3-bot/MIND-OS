import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { METRIC_CONFIG, calculateIQ } from "@/lib/cognitiveEngine";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { ANIM_CONFIG } from "@/lib/animations";
import { motion } from "framer-motion";
import MasteryRadar from "./MasteryRadar";

const SUBJECT_CATS = [
  { id: "body", label: "BODY", color: "#ff4400", icon: "💪", activities: ["exercise", "running", "cold_shower", "nutrition", "sleep"] },
  { id: "sciences", label: "SCIENCES", color: "#3b82f6", icon: "🔬", activities: ["mathematics", "physics", "chemistry", "biology", "computer_science", "coding"] },
  { id: "languages", label: "LANGUAGES", color: "#00cc88", icon: "🌐", activities: ["english", "german", "other_languages"] },
  { id: "spirit", label: "SPIRIT", color: "#9944ff", icon: "✨", activities: ["prayer_meditation", "prayer", "meditation", "mindfulness", "reading_philosophy"] },
  { id: "humanities", label: "HUMANITIES", color: "#f0c040", icon: "📚", activities: ["reading", "philosophy", "history", "humanities", "writing"] },
];

function projectMetric(current, ceiling, dailyRate, days) {
  let val = current;
  for (let d = 0; d < days; d++) {
    const ratio = val / ceiling;
    const multiplier = Math.max(0, 1 - Math.pow(ratio, 2));
    val = Math.min(ceiling, val + dailyRate * multiplier);
  }
  return Math.round(val * 10) / 10;
}

function daysTo90Pct(current, ceiling, dailyRate) {
  if (dailyRate <= 0) return null;
  const target = ceiling * 0.90;
  if (current >= target) return 0;
  let val = current;
  let days = 0;
  while (val < target && days < 3650) {
    const ratio = val / ceiling;
    const multiplier = Math.max(0, 1 - Math.pow(ratio, 2));
    val = Math.min(ceiling, val + dailyRate * multiplier);
    days++;
  }
  return days < 3650 ? days : null;
}

export default function ProjectionTable({ profile, logs }) {
  const { t } = useTranslation();
  const { dailyRates, projections, avgHoursPerDay, avgFocus, subjectStats } = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentLogs = logs.filter(l => new Date(l.created_at) >= sevenDaysAgo);

    const dailyRates = {};
    Object.keys(METRIC_CONFIG).forEach(mk => {
      const totalGain = recentLogs.reduce((sum, l) => sum + (l[`${mk}_gain`] || 0), 0);
      dailyRates[mk] = totalGain / 7;
    });

    const proj = {};
    Object.keys(METRIC_CONFIG).forEach(mk => {
      const current = profile[mk];
      const ceiling = profile[`${mk}_ceiling`];
      const rate = dailyRates[mk];
      proj[mk] = {
        current,
        ceiling,
        p7: projectMetric(current, ceiling, rate, 7),
        p30: projectMetric(current, ceiling, rate, 30),
        p90: projectMetric(current, ceiling, rate, 90),
        p365: projectMetric(current, ceiling, rate, 365),
        days90pct: daysTo90Pct(current, ceiling, rate),
      };
    });

    const avgHoursPerDay = recentLogs.reduce((s, l) => s + (l.hours || 0), 0) / 7;
    const focusArr = recentLogs.map(l => l.focus_rating || 5);
    const avgFocus = focusArr.length > 0 ? focusArr.reduce((a, b) => a + b, 0) / focusArr.length : 5;

    // Subject category hours
    const subjectStats = SUBJECT_CATS.map(cat => {
      const catLogs = logs.filter(l => cat.activities.includes(l.activity_key));
      const recentCatLogs = recentLogs.filter(l => cat.activities.includes(l.activity_key));
      const totalHours = catLogs.reduce((s, l) => s + (l.hours || 0), 0);
      const weekHours = recentCatLogs.reduce((s, l) => s + (l.hours || 0), 0);
      const dailyRate = weekHours / 7;
      // Estimate % toward a notional "mastery" of 500 hours
      const MASTERY = 500;
      const pct = Math.min(100, (totalHours / MASTERY) * 100);
      const pct30d = Math.min(100, ((totalHours + dailyRate * 30) / MASTERY) * 100);
      const pct90d = Math.min(100, ((totalHours + dailyRate * 90) / MASTERY) * 100);
      return { ...cat, totalHours, weekHours, dailyRate, pct, pct30d, pct90d };
    });

    return { dailyRates, projections: proj, avgHoursPerDay, avgFocus, subjectStats };
  }, [profile, logs]);

  const currentIQ = calculateIQ(profile.gf, profile.gc, profile.ps, profile.vm);
  const iq7 = calculateIQ(projections.gf?.p7, projections.gc?.p7, projections.ps?.p7, projections.vm?.p7);
  const iq30 = calculateIQ(projections.gf?.p30, projections.gc?.p30, projections.ps?.p30, projections.vm?.p30);
  const iq90 = calculateIQ(projections.gf?.p90, projections.gc?.p90, projections.ps?.p90, projections.vm?.p90);
  const iq365 = calculateIQ(projections.gf?.p365, projections.gc?.p365, projections.ps?.p365, projections.vm?.p365);

  const colorMap = { gf: "text-gf", gc: "text-gc", ps: "text-ps", vm: "text-vm" };

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{t('projection.avgPace')}</div>

      {/* Cognitive metrics table */}
      <div className="overflow-x-auto" onPointerDownCapture={(e) => e.stopPropagation()}>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-muted-foreground/60 font-medium">{t('projection.metric')}</th>
              <th className="text-right py-2 px-3 text-muted-foreground/60 font-medium">{t('projection.now')}</th>
              <th className="text-right py-2 px-3 text-muted-foreground/60 font-medium">{t('projection.plus30d')}</th>
              <th className="text-right py-2 px-3 text-muted-foreground/60 font-medium">{t('projection.plus90d')}</th>
              <th className="text-right py-2 px-3 text-muted-foreground/60 font-medium">{t('projection.plus1y')}</th>
              <th className="text-right py-2 px-3 text-muted-foreground/60 font-medium">{t('projection.ceiling')}</th>
              <th className="text-right py-2 pl-3 text-muted-foreground/60 font-medium">{t('projection.eta')}</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(METRIC_CONFIG).map(([mk, mc]) => {
              const p = projections[mk];
              if (!p) return null;
              const etaDate = p.days90pct != null
                ? new Date(Date.now() + p.days90pct * 86400000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "—";
              return (
                <tr key={mk} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className={`py-2.5 pr-4 font-bold ${colorMap[mk]}`}>{mc.abbr}</td>
                  <td className="text-right py-2.5 px-3 text-foreground/80">{p.current.toFixed(1)}</td>
                  <td className="text-right py-2.5 px-3 text-foreground">{p.p30.toFixed(1)}</td>
                  <td className="text-right py-2.5 px-3 text-foreground">{p.p90.toFixed(1)}</td>
                  <td className="text-right py-2.5 px-3 text-foreground">{p.p365.toFixed(1)}</td>
                  <td className="text-right py-2.5 px-3 text-muted-foreground/50">{p.ceiling}</td>
                  <td className="text-right py-2.5 pl-3 text-muted-foreground/70">{etaDate}</td>
                </tr>
              );
            })}
            <tr className="bg-muted/10">
              <td className="py-2.5 pr-4 font-bold text-foreground/90">{t('projection.iq')}</td>
              <td className="text-right py-2.5 px-3 text-foreground/80">{currentIQ.toFixed(1)}</td>
              <td className="text-right py-2.5 px-3 text-foreground font-semibold">{iq30.toFixed(1)}</td>
              <td className="text-right py-2.5 px-3 text-foreground font-semibold">{iq90.toFixed(1)}</td>
              <td className="text-right py-2.5 px-3 text-foreground font-semibold">{iq365.toFixed(1)}</td>
              <td className="text-right py-2.5 px-3 text-muted-foreground/50">—</td>
              <td className="text-right py-2.5 pl-3 text-muted-foreground/70">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Radar Chart */}
      <div className="border-t border-border pt-5 space-y-4">
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">📊 MASTERY RADAR</div>
        <div className="h-[250px] w-full">
          <MasteryRadar
            subjectStats={subjectStats}
            outerRadius="65%"
            fontSize={10}
            dotRadius={5}
            showIcons={false}
          />
        </div>
      </div>

      {/* Subject categories */}
      <div className="border-t border-border pt-5 space-y-4">
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{t('projection.subjectMastery')}</div>
        <div className="space-y-3">
          {subjectStats.map(cat => (
            <div key={cat.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span>{cat.icon}</span>
                  <span className="font-bold" style={{ color: cat.color }}>{cat.label}</span>
                  <span className="text-muted-foreground/40"><AnimatedNumber value={cat.totalHours} formatter={(v) => v.toFixed(1)} />{t('projection.hTotal')}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-muted-foreground/50">{t('projection.nowSmall')}<span className="font-bold text-foreground/70"><AnimatedNumber value={cat.pct} formatter={(v) => v.toFixed(1)} />%</span></span>
                  <span className="text-muted-foreground/50">+30d <span className="font-bold" style={{ color: cat.color }}><AnimatedNumber value={cat.pct30d} formatter={(v) => v.toFixed(1)} />%</span></span>
                  <span className="text-muted-foreground/50">+90d <span className="font-bold" style={{ color: cat.color }}><AnimatedNumber value={cat.pct90d} formatter={(v) => v.toFixed(1)} />%</span></span>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden relative">
                {/* Now bar */}
                <motion.div className="h-full rounded-full absolute top-0 left-0 opacity-40"
                  animate={{ width: `${cat.pct90d}%` }} transition={ANIM_CONFIG.springBar} style={{ background: cat.color }} />
                <motion.div className="h-full rounded-full absolute top-0 left-0 opacity-60"
                  animate={{ width: `${cat.pct30d}%` }} transition={ANIM_CONFIG.springBar} style={{ background: cat.color }} />
                <motion.div className="h-full rounded-full absolute top-0 left-0"
                  animate={{ width: `${cat.pct}%` }} transition={ANIM_CONFIG.springBar} style={{ background: cat.color, boxShadow: `0 0 6px ${cat.color}` }} />
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/30">
                {cat.weekHours.toFixed(1)}h this week · {cat.dailyRate.toFixed(2)}h/day avg · goal: 500h mastery
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Motivational */}
      <div className="p-3 rounded-lg border border-border/40 bg-muted/20 text-xs font-mono text-muted-foreground/70 leading-relaxed">
        <span className="text-foreground/50">{t('projection.toReach')}</span>
        <span className="font-bold" style={{ color: "#f59e0b" }}>{t('projection.godMode')}</span>
        <span className="text-foreground/50">{t('projection.in30Days')}</span>
        <span className="text-foreground">{t('projection.7hDay')}</span>
        <span className="text-foreground/50">{t('projection.atFocus')}</span>
        <span className="text-foreground">9+</span>
        <span className="text-foreground/50">{t('projection.withA')}</span>
        <span className="text-foreground">{t('projection.streak30')}</span>
        <span className="text-foreground/50">.</span>
      </div>
    </div>
  );
}