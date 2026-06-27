import { useRef, useState, useCallback } from "react";

const THRESHOLD = 72; // px needed to trigger refresh

export default function usePullToRefresh(onRefresh) {
  const pullRef = useRef(null);
  const startY = useRef(null);
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState(0);
  const triggered = useRef(false);

  const onTouchStart = useCallback((e) => {
    // Only activate when scrolled to top of container and window
    const el = pullRef.current;
    if (!el) return;
    const scrollTop = el.scrollTop || window.scrollY || document.documentElement.scrollTop || 0;
    if (scrollTop > 2) return;
    startY.current = e.touches[0].clientY;
    triggered.current = false;
  }, []);

  const onTouchMove = useCallback((e) => {
    if (startY.current === null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { setPulling(false); setProgress(0); return; }
    setPulling(true);
    setProgress(delta / THRESHOLD);
    // Prevent default scroll bounce only when actively pulling down
    if (delta > 4) e.preventDefault();
  }, []);

  const onTouchEnd = useCallback(() => {
    if (pulling && progress >= 1 && !triggered.current) {
      triggered.current = true;
      onRefresh?.();
    }
    startY.current = null;
    setPulling(false);
    setProgress(0);
  }, [pulling, progress, onRefresh]);

  // Attach listeners via ref callback pattern
  const setRef = useCallback((node) => {
    if (pullRef.current) {
      pullRef.current.removeEventListener("touchstart", onTouchStart);
      pullRef.current.removeEventListener("touchmove", onTouchMove);
      pullRef.current.removeEventListener("touchend", onTouchEnd);
    }
    pullRef.current = node;
    if (node) {
      node.addEventListener("touchstart", onTouchStart, { passive: true });
      node.addEventListener("touchmove", onTouchMove, { passive: false });
      node.addEventListener("touchend", onTouchEnd, { passive: true });
    }
  }, [onTouchStart, onTouchMove, onTouchEnd]);

  return { pullRef: setRef, pulling, progress };
}