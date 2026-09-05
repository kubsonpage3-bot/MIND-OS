// @ts-nocheck
import React, { useRef, useEffect } from 'react';

/**
 * Lightweight ambient atmospheric particle canvas for the Boss Arena
 * Adapts particles (embers, ink wisps, frost crystals, void motes) based on the boss theme.
 */
export default function BossArenaCanvas({ bossId = '', color = '#22c55e', phase = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    let width = (canvas.width = canvas.offsetWidth || 300);
    let height = (canvas.height = canvas.offsetHeight || 220);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth || 300;
      height = canvas.height = canvas.offsetHeight || 220;
    };

    window.addEventListener('resize', handleResize);

    // Determine particle profile
    const isFire = bossId.includes('ember') || bossId.includes('ashen') || color === '#ff4444';
    const isFrost = bossId.includes('frost') || bossId.includes('winter');
    const isInk = bossId.includes('ink') || bossId.includes('misted') || bossId.includes('jackal');
    const isVoid = bossId.includes('god') || bossId.includes('dusk') || bossId.includes('eclipse') || color === '#ff00ff';

    // Particle count scales slightly with boss phase
    const count = phase === 3 ? 36 : phase === 2 ? 26 : 18;

    const particles = Array.from({ length: count }, () => {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * (isFrost ? 2.5 : isFire ? 3 : 2) + 1,
        speedX: (Math.random() - 0.5) * (isFrost ? 0.4 : 0.8),
        speedY: isFire ? -(Math.random() * 0.9 + 0.3) : isFrost ? (Math.random() * 0.6 + 0.2) : (Math.random() - 0.5) * 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.03,
      };
    });

    let lastTime = performance.now();

    const render = (time) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Radial base ambient lighting behind the boss
      const grad = ctx.createRadialGradient(
        width / 2,
        height * 0.45,
        10,
        width / 2,
        height * 0.45,
        width * 0.65
      );
      
      const glowOpacity = phase === 3 ? '0.28' : phase === 2 ? '0.20' : '0.14';
      grad.addColorStop(0, `${color}${Math.round(parseFloat(glowOpacity) * 255).toString(16).padStart(2, '0')}`);
      grad.addColorStop(0.7, 'transparent');
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Render floating particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.speedX;
        p.y += p.speedY;
        p.pulse += p.pulseSpeed;

        // Wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const currentOpacity = Math.max(0.1, p.opacity + Math.sin(p.pulse) * 0.25);

        ctx.save();
        ctx.globalAlpha = currentOpacity;
        ctx.fillStyle = isFire 
          ? (Math.random() > 0.4 ? '#fbbf24' : '#ef4444') 
          : isFrost 
          ? '#e0f2fe' 
          : isVoid 
          ? '#e879f9' 
          : color;

        ctx.shadowColor = color;
        ctx.shadowBlur = phase === 3 ? 12 : 6;

        ctx.beginPath();
        if (isFrost) {
          // Diamond frost flake
          ctx.moveTo(p.x, p.y - p.size);
          ctx.lineTo(p.x + p.size, p.y);
          ctx.lineTo(p.x, p.y + p.size);
          ctx.lineTo(p.x - p.size, p.y);
          ctx.closePath();
        } else {
          // Circular ember / ink droplet
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [bossId, color, phase]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 rounded-xl"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
