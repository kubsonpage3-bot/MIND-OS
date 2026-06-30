import { useMemo } from "react";

const AXES = [
  { key: "body",       label: "BODY",       color: "#ff4400", subjects: ["exercise", "running"],                                    target: 100  },
  { key: "sciences",   label: "SCIENCES",   color: "#3388ff", subjects: ["mathematics", "physics", "coding", "chess"],             target: 200  },
  { key: "languages",  label: "LANGUAGES",  color: "#00cc88", subjects: ["english", "german", "other_languages"],                  target: 150  },
  { key: "spirit",     label: "SPIRIT",     color: "#9944ff", subjects: ["prayer_meditation"],                                      target: 50   },
  { key: "humanities", label: "HUMANITIES", color: "#ffaa00", subjects: ["vocabulary", "history", "philosophy", "creative_answers", "reading"], target: 150 },
];

function polarToXY(angle, r, cx, cy) {
  const rad = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function buildPath(values, maxR, cx, cy, n) {
  return values
    .map((v, i) => {
      const angle = (360 / n) * i;
      const r = v * maxR;
      const { x, y } = polarToXY(angle, r, cx, cy);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ") + " Z";
}

export default function RadarChart({ profile, logs }) {
  const SIZE = 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const maxR = SIZE / 2 - 28;
  const n = AXES.length;

  const { scores, hoursPerAxis } = useMemo(() => {
    // Sum hours per subject key across all logs
    const hoursBySubject = {};
    logs.forEach(l => {
      if (l.activity_key) {
        hoursBySubject[l.activity_key] = (hoursBySubject[l.activity_key] || 0) + (l.hours || 0);
      }
    });

    const hoursPerAxis = AXES.map(axis =>
      axis.subjects.reduce((sum, s) => sum + (hoursBySubject[s] || 0), 0)
    );
    const scores = AXES.map((axis, i) => Math.min(hoursPerAxis[i] / axis.target, 1));
    return { scores, hoursPerAxis };
  }, [logs]);

  const rings = [0.25, 0.5, 0.75, 1.0];

  return (
    <div className="flex flex-col items-center">
      <div className="text-xs font-mono text-muted-foreground/60 uppercase tracking-wider mb-3">
        Cognitive Shape
      </div>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={Array.from({ length: n }, (_, i) => {
              const angle = (360 / n) * i;
              const { x, y } = polarToXY(angle, r * maxR, cx, cy);
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {AXES.map((_, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToXY(angle, maxR, cx, cy);
          return (
            <line key={i} x1={cx} y1={cy} x2={x} y2={y}
              stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          );
        })}

        {/* Ghost shape (100% = full potential) */}
        <path
          d={buildPath([1,1,1,1,1], maxR, cx, cy, n)}
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Current shape — multi-color fill using each axis color as gradient approximation */}
        <path
          d={buildPath(scores, maxR, cx, cy, n)}
          fill="rgba(59,130,246,0.10)"
          stroke="#3b82f6"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 6px rgba(59,130,246,0.4))" }}
        />

        {/* Colored dots per axis */}
        {scores.map((v, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToXY(angle, Math.max(v * maxR, 3), cx, cy);
          return (
            <circle key={i} cx={x} cy={y} r={3}
              fill={AXES[i].color}
              style={{ filter: `drop-shadow(0 0 4px ${AXES[i].color})` }} />
          );
        })}

        {/* Labels with axis color */}
        {AXES.map(({ label, color }, i) => {
          const angle = (360 / n) * i;
          const { x, y } = polarToXY(angle, maxR + 16, cx, cy);
          return (
            <text key={i} x={x} y={y}
              textAnchor="middle" dominantBaseline="middle"
              fill={color} fillOpacity="0.85"
              fontSize="9" fontFamily="Space Mono, monospace"
              fontWeight="700" letterSpacing="0.05em"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Score breakdown */}
      <div className="flex gap-3 mt-2 flex-wrap justify-center">
        {AXES.map(({ label, color }, i) => (
          <div key={i} className="text-center">
            <div className="text-[10px] font-mono" style={{ color }}>{label}</div>
            <div className="text-xs font-mono font-bold text-foreground/80">
              {Math.round(scores[i] * 100)}%
            </div>
            <div className="text-[9px] font-mono text-muted-foreground/50">
              {hoursPerAxis[i].toFixed(1)}h
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}