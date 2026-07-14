import { useState, useEffect } from "react";
import ServerWakeupSkeleton from "./ServerWakeupSkeleton";
import { HOST_ORIGIN } from "@/api/djangoClient";

// In native Capacitor (Android/iOS) the capacitor:// WebView scheme causes
// fetch() to throw "Failed to fetch" even for valid HTTPS endpoints.
// The backend is kept warm by external pings, so we skip the wakeup check.
const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

export default function ServerWakeupWrapper({ children }) {
  if (isNative) return children;
  const [isAwake, setIsAwake] = useState(false);
  const [waitDuration, setWaitDuration] = useState(0);
  const [failed, setFailed] = useState(false);
  const [lastError, setLastError] = useState(null);

  useEffect(() => {
    let active = true;
    let timer = null;
    let pollTimeout = null;

    const startWaitTimer = () => {
      timer = setInterval(() => {
        if (active) setWaitDuration(d => d + 1);
      }, 1000);
    };

    const pingHealth = async (attempt = 0) => {
      if (!active) return;
      
      try {
        const response = await fetch(`${HOST_ORIGIN}/api/health/`, {
          method: 'GET',
          // Let the browser handle cache bypassing natively to prevent CORS preflight issues
          cache: 'no-store'
        });
        
        if (response.ok) {
          if (active) setIsAwake(true);
          return;
        }
      } catch (e) {
        // network error, typical for sleeping server or no connection
        if (active) setLastError(e.message || e.toString());
      }
      
      // If we reach 90 seconds of waiting (or ~45 attempts of 2s), we fail to a retry button
      if (attempt >= 45) {
        if (active) setFailed(true);
        return;
      }

      // Exponential backoff or static 2s polling
      if (active) {
        pollTimeout = setTimeout(() => pingHealth(attempt + 1), 2000);
      }
    };

    startWaitTimer();
    pingHealth();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      if (pollTimeout) clearTimeout(pollTimeout);
    };
  }, [failed]); // Add failed to dep array so we can retry by setting it to false

  if (isAwake) {
    return children;
  }

  const handleRetry = () => {
    setFailed(false);
    setWaitDuration(0);
  };

  let message = "Waking up the server... this can take up to two minutes on first load.";
  if (failed) {
    message = `The server is taking longer than expected. Please check your connection or try again. (Error: ${lastError})`;
  } else if (waitDuration > 15) {
    message = `Server is still spinning up... thanks for your patience! (Last error: ${lastError})`;
  }

  return (
    <ServerWakeupSkeleton 
      message={message} 
      isLongWait={waitDuration > 15 || failed} 
      onRetry={failed ? handleRetry : null} 
    />
  );
}
