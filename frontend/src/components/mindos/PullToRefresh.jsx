import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { playSound } from '@/lib/soundEffects';

const THRESHOLD = 80;
const MAX_PULL = 130;

export default function PullToRefresh({ children, onRefresh, scrollRef }) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  
  const startY = useRef(0);
  const startX = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const directionLocked = useRef(false);
  const ignoreDrag = useRef(false);

  const controls = useAnimation();

  useEffect(() => {
    const element = scrollRef?.current || document.body;

    const handleTouchStart = (e) => {
      // Ignore if touching any part of a draggable task card (not just the handle)
      if (
        e.target.closest('[data-rfd-drag-handle-context-id]') ||
        e.target.closest('[data-rfd-draggable-context-id]')
      ) {
        ignoreDrag.current = true;
        return;
      }
      // Also ignore if a DnD drag is already in progress
      if (document.body.classList.contains('is-dragging-task')) {
        ignoreDrag.current = true;
        return;
      }

      if (scrollRef?.current && scrollRef.current.scrollTop > 0) {
        ignoreDrag.current = true;
        return;
      }

      ignoreDrag.current = false;
      directionLocked.current = false;
      isDragging.current = true;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      currentY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e) => {
      // Yield to DnD immediately if a drag-reorder is active
      if (document.body.classList.contains('is-dragging-task')) {
        ignoreDrag.current = true;
        return;
      }
      if (ignoreDrag.current || !isDragging.current || refreshing) return;

      const y = e.touches[0].clientY;
      const x = e.touches[0].clientX;
      const dy = y - startY.current;
      const dx = x - startX.current;

      // 1. Gesture Disambiguation Logic
      if (!directionLocked.current) {
        // Wait until we have moved at least 5 pixels to determine direction
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal swipe detected, ignore pull-to-refresh
            ignoreDrag.current = true;
            return;
          } else {
            // Vertical swipe detected, lock direction
            directionLocked.current = true;
            if (dy < 0) {
              // Scrolling down the page normally, ignore pull-to-refresh
              ignoreDrag.current = true;
              return;
            }
          }
        } else {
          return; // Not enough movement yet
        }
      }

      // If we are locked into a vertical pull down, handle it
      if (dy > 0) {
        // Cancel native scroll / overscroll behavior to prevent the browser's default refresh
        if (e.cancelable) {
          e.preventDefault();
        }
        
        // Add physical resistance using square root curve
        const pull = Math.min(Math.sqrt(dy) * 6, MAX_PULL);
        setPullDistance(pull);
        controls.set({ y: pull });
      }
    };

    const handleTouchEnd = async () => {
      if (ignoreDrag.current || !isDragging.current || refreshing) {
        isDragging.current = false;
        return;
      }

      isDragging.current = false;
      directionLocked.current = false;
      
      if (pullDistance >= THRESHOLD) {
        setRefreshing(true);
        playSound('ui_click');
        controls.start({ y: 60, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        
        try {
          if (onRefresh) await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
          controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } });
        }
      } else {
        // Did not pull far enough, snap back
        setPullDistance(0);
        controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 25 } });
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    // Need passive: false on touchmove to allow e.preventDefault()
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [scrollRef, refreshing, pullDistance, onRefresh, controls]);

  const fillPercentage = Math.min(pullDistance / THRESHOLD, 1);

  // Indicator height so we know how far to push content down
  const INDICATOR_HEIGHT = 64;

  return (
    <div className="w-full">
      {/* Indicator — visible above content, pushed down with content via translateY */}
      <motion.div
        style={{ height: INDICATOR_HEIGHT, marginTop: -INDICATOR_HEIGHT }}
        animate={controls}
        className="flex justify-center items-end pb-3 pointer-events-none"
      >
        <div className="flex flex-col items-center gap-1">
          <div className="flex space-x-2">
            <div
              className={`w-3 h-3 shadow-[2px_2px_0_rgba(0,0,0,0.5)] transition-colors duration-200 ${refreshing ? 'animate-bounce bg-[var(--habit-gold)]' : fillPercentage > 0.3 ? 'bg-[var(--habit-gold)]' : 'bg-muted'}`}
              style={{ animationDelay: '0ms' }}
            />
            <div
              className={`w-3 h-3 shadow-[2px_2px_0_rgba(0,0,0,0.5)] transition-colors duration-200 ${refreshing ? 'animate-bounce bg-[var(--habit-gold)]' : fillPercentage > 0.6 ? 'bg-[var(--habit-gold)]' : 'bg-muted'}`}
              style={{ animationDelay: '150ms' }}
            />
            <div
              className={`w-3 h-3 shadow-[2px_2px_0_rgba(0,0,0,0.5)] transition-colors duration-200 ${refreshing ? 'animate-bounce bg-[var(--habit-gold)]' : fillPercentage >= 1 ? 'bg-[var(--habit-gold)]' : 'bg-muted'}`}
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-[10px] font-bold font-mono text-[var(--habit-text)] uppercase tracking-wider">
            {refreshing ? 'SYNCING...' : pullDistance >= THRESHOLD ? 'RELEASE TO SYNC' : 'PULL TO SYNC'}
          </span>
        </div>
      </motion.div>

      {/* Content pushed down by same translateY */}
      <motion.div animate={controls} className="min-h-full">
        {children}
      </motion.div>
    </div>
  );
}
