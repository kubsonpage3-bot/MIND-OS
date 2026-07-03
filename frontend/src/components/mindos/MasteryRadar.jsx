import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function MasteryRadar({ 
  subjectStats, 
  outerRadius = "65%", 
  fontSize = 10,
  dotRadius = 5,
  showIcons = false,
  strokeColor = "transparent",
  fillColor = "transparent",
  fillOpacity = 0.2
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart cx="50%" cy="50%" outerRadius={outerRadius} data={subjectStats}>
        <PolarGrid stroke="rgba(255,255,255,0.15)" />
        <PolarAngleAxis 
          dataKey="label" 
          tick={({ payload, x, y, textAnchor }) => {
            const cat = subjectStats.find(s => s.label === payload.value);
            return (
              <text 
                x={x} 
                y={y} 
                textAnchor={textAnchor} 
                fill={cat?.color || "#fff"} 
                fontSize={fontSize} 
                fontFamily="'Pixeltype', monospace" 
                fontWeight="normal" 
                dy={fontSize * 0.4}
              >
                {showIcons && cat?.icon ? `${cat.icon} ` : ""}{payload.value}
              </text>
            );
          }} 
        />
        <Radar 
          name="Current" 
          dataKey="pct" 
          stroke={strokeColor} 
          fill={fillColor} 
          fillOpacity={fillOpacity}
          isAnimationActive={false}
          dot={(props) => {
            const { cx, cy, payload } = props;
            const color = payload.color || "#fff";
            return (
              <circle 
                key={`dot-${payload.id || payload.label}`}
                cx={cx} 
                cy={cy} 
                r={dotRadius} 
                fill={color} 
                stroke="none"
                style={{ filter: `drop-shadow(0 0 ${dotRadius * 1.2}px ${color})` }}
              />
            );
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
