// @ts-nocheck
/**
 * Loading placeholders for the Eat Journal.
 *
 * Before this existed the page rendered real zeros while the day was still
 * in flight, which reads as "you ate nothing" rather than "still loading".
 */

export function Skel({ w = '100%', h = 12, r = 8, style = {} }) {
  return <div className="ej-skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SummarySkeleton() {
  return (
    <div className="ej-card" style={{ padding: 18 }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-2">
          <Skel w={110} h={16} />
          <Skel w={148} h={11} />
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => <Skel key={i} w={32} h={32} r={11} />)}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2 py-2">
        {[84, 68, 68, 68].map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skel w={s} h={s} r={999} />
            <Skel w={s * 0.55} h={9} />
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--ej-hairline)' }}>
        <Skel h={10} w="55%" />
        <Skel h={8} r={999} />
        <Skel h={8} r={999} w="80%" />
      </div>
    </div>
  );
}

export function MealCardSkeleton({ accent = '#f59e0b' }) {
  return (
    <div className="ej-card" style={{ padding: '14px 16px', borderLeft: `3px solid ${accent}55` }}>
      <div className="flex items-center gap-3">
        <Skel w={34} h={34} r={12} />
        <div className="flex-1 flex flex-col gap-2">
          <Skel w={96} h={13} />
          <Skel w={150} h={9} />
        </div>
        <Skel w={72} h={30} r={999} />
      </div>
    </div>
  );
}

export function RailSkeleton({ count = 5 }) {
  return (
    <div className="ej-rail">
      {Array.from({ length: count }).map((_, i) => (
        <Skel key={i} w={128} h={58} r={14} />
      ))}
    </div>
  );
}
