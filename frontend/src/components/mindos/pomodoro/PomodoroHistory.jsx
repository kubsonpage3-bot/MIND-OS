import { useTranslation } from 'react-i18next';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useRef, useEffect } from 'react';

export default function PomodoroHistory() {
  const { t } = useTranslation();
  const { heatmapData, isHeatmapLoading } = usePomodoro();
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !heatmapData) return;

    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    
    // Clear
    ctx.clearRect(0, 0, width, height);

    const cellSize = 10;
    const cellGap = 3;
    const cols = 53;
    const rows = 7;

    // We'll just draw a generic 53x7 grid representing a year
    // For a real implementation, we'd map dates exactly.
    // For now, let's just render the grid and color it based on values.

    // A simple hash function to map a string date to a 0-370 index 
    // just to visualize the data if dates are random
    
    const colors = {
      0: getComputedStyle(document.documentElement).getPropertyValue('--card').trim() || '#1a1a2e',
      1: '#2d1b4e',
      2: '#6b21a8',
      3: '#9333ea',
      4: '#c084fc',
    };

    // Parse real dates from heatmapData to an array of 371 cells (last 53 weeks)
    const cells = new Array(cols * rows).fill(0);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (const [dateStr, count] of Object.entries(heatmapData)) {
        const d = new Date(dateStr);
        d.setHours(0,0,0,0);
        
        const diffTime = Math.abs(today - d);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < cols * rows) {
            // Map day to grid. Index 370 is today (bottom right corner approx)
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
        <div className="overflow-x-auto pb-2">
          <canvas 
            ref={canvasRef} 
            width={(10 + 3) * 53} 
            height={(10 + 3) * 7}
            className="w-[689px] h-[91px]"
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
