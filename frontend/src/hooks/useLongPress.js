import { useCallback, useRef } from 'react';

export function useLongPress(onLongPress, onClick, { delay = 500, moveThreshold = 15 } = {}) {
  const timeoutRef = useRef(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const start = useCallback((e) => {
    // Only left click or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ignore if clicked on a button or drag handle
    if (e.target.closest('button') || e.target.closest('[aria-label="Drag to reorder"]')) return;

    isLongPressRef.current = false;
    startPosRef.current = { x: e.clientX, y: e.clientY };

    timeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (onLongPress) onLongPress(e);
    }, delay);
  }, [onLongPress, delay]);

  const clear = useCallback((e, shouldTriggerClick = false) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (shouldTriggerClick && !isLongPressRef.current) {
      if (onClick) onClick(e);
    }
  }, [onClick]);

  const onPointerMove = useCallback((e) => {
    if (!timeoutRef.current) return;

    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);

    if (dx > moveThreshold || dy > moveThreshold) {
      clear(e, false);
    }
  }, [clear, moveThreshold]);

  const onContextMenu = useCallback((e) => {
    // Prevent context menu from popping up
    // On mobile, hold triggers context menu. We want to stop it.
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return {
    onPointerDown: start,
    onPointerUp: (e) => clear(e, true),
    onPointerLeave: (e) => clear(e, false),
    onPointerMove,
    onContextMenu,
    style: {
      WebkitTouchCallout: 'none',
      userSelect: 'none',
    }
  };
}
