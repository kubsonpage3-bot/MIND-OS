import { useState, useEffect } from "react";
import ServerWakeupSkeleton from "./ServerWakeupSkeleton";
import { HOST_ORIGIN } from "@/api/djangoClient";

export default function ServerWakeupWrapper({ children }) {
  const [isAwake, setIsAwake] = useState(false);
  const [waitDuration, setWaitDuration] = useState(0);
  const [failed, setFailed] = useState(false);

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
    message = "The server is taking longer than expected. Please check your connection or try again.";
  } else if (waitDuration > 15) {
    message = "Server is still spinning up... thanks for your patience!";
  }

  return (
    <ServerWakeupSkeleton 
      message={message} 
      isLongWait={waitDuration > 15 || failed} 
      onRetry={failed ? handleRetry : null} 
    />
  );
}
