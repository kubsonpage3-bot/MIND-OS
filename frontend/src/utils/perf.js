import { useEffect, useRef } from "react";

export function useProfileMount(name) {
  const startRef = useRef(performance.now());
  useEffect(() => {
    const duration = performance.now() - startRef.current;
    console.log(`[PERF] ${name} mounted in ${duration.toFixed(2)}ms`);
  }, [name]);
}
