import { useTranslation } from 'react-i18next';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useRef, useEffect } from 'react';

export default function PomodoroHistory() {
  const { t } = useTranslation();
  const { heatmapData, isHeatmapLoading } = usePomodoro();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !heatmapData) return;

    const draw = () => {
      if (!canvasRef.current || !heatmapData) return;
      const canvas = canvasRef.current;
      const container = canvas.parentElement;
      const width = container.clientWidth;

      const cellSize = 10;
      const cellGap = 3;
      const rows = 7;
      // Calculate how many columns fit, max 53 (1 year)
      const maxCols = 53;
      const calculatedCols = Math.floor(width / (cellSize + cellGap));
      const cols = Math.min(maxCols, calculatedCols);

      // Set actual canvas resolution
      canvas.width = cols * (cellSize + cellGap);
      canvas.height = rows * (cellSize + cellGap);

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const colors = {
        0: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#1a1a2e',
        1: '#2d1b4e',
        2: '#6b21a8',
        3: '#9333ea',
        4: '#c084fc',
      };

      // Parse real dates from heatmapData to an array of (cols * rows) cells
      const cells = new Array(cols * rows).fill(0);
      
      const today = new Date();
      today.setHours(0,0,0,0);
      
      for (const [dateStr, count] of Object.entries(heatmapData)) {
          const d = new Date(dateStr);
          d.setHours(0,0,0,0);
          
          const diffTime = Math.abs(today - d);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays < cols * rows) {
              // Map day to grid. The newest day is at the bottom right.
              const index = (cols * rows - 1) - diffDays;
              if (index >= 0 && index < cells.length) {
                  cells[index] = count;
              }
          }
      }

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * (cellSize + cellGap);
          const y = r * (cellSize + cellGap);
          
          const index = c * rows + r;
          const val = cells[index] || 0;
          
          let colorKey = 0;
          if (val > 0) colorKey = 1;
          if (val >= 3) colorKey = 2;
          if (val >= 6) colorKey = 3;
          if (val >= 10) colorKey = 4;

          ctx.fillStyle = colors[colorKey];
          ctx.beginPath();
          ctx.roundRect(x, y, cellSize, cellSize, 2);
          ctx.fill();
        }
      }
    };

    draw();

    const container = canvasRef.current?.parentElement;
    if (!container) return;

    // Use ResizeObserver for precise container size changes
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);

    // Fallback resize listener just in case
    window.addEventListener('resize', draw);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [heatmapData]);

  if (isHeatmapLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="bg-card border border-border rounded-2xl p-4">
        <h3 className="text-xs font-mono font-bold uppercase mb-4 text-muted-foreground">
          {t('pomodoro.history.heatmap', 'Activity Heatmap')}
        </h3>
        <div className="w-full flex justify-end pb-2">
          <canvas 
            ref={canvasRef} 
            className="block"
          />
        </div>
        <div className="flex justify-end gap-1 mt-3 items-center text-[9px] font-mono text-muted-foreground uppercase">
          <span>Less</span>
          <div className="w-2 h-2 rounded-sm" style={{background: '#1a1a2e'}} />
          <div className="w-2 h-2 rounded-sm" style={{background: '#2d1b4e'}} />
          <div className="w-2 h-2 rounded-sm" style={{background: '#6b21a8'}} />
          <div className="w-2 h-2 rounded-sm" style={{background: '#9333ea'}} />
          <div className="w-2 h-2 rounded-sm" style={{background: '#c084fc'}} />
          <span>More</span>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-4 flex flex-col items-center justify-center py-8">
        <p className="text-xs font-mono text-muted-foreground text-center">
          {t('pomodoro.history.chartsComingSoon', 'Detailed charts coming soon...')}
        </p>
      </div>
    </div>
  );
}
