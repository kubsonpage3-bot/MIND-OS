import { useState, useEffect } from 'react';

export function useIsTWA() {
  const [state, setState] = useState({
    isTWA: false,
    isLoading: true, // Prevents race condition/UI flickering
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      setState({ isTWA: false, isLoading: false });
      return;
    }

    // 1. Sync check: Referrer
    const hasTwaReferrer = document.referrer.includes("android-app://");
    if (hasTwaReferrer) {
      sessionStorage.setItem("mindos_is_twa", "true");
    }
    const isKnownTwa = hasTwaReferrer || sessionStorage.getItem("mindos_is_twa") === "true";
    
    // 2. Sync check: Display mode
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    
    // 3. Sync check: OS
    const isAndroid = /Android/i.test(navigator.userAgent);

    if (isAndroid && isStandalone && isKnownTwa) {
      // Confidently detected synchronously
      setState({ isTWA: true, isLoading: false });
      return;
    }

    // If it's Android + Standalone but referrer is missing (e.g. Deep link), 
    // we MUST block the UI until the async check finishes.
    if (isAndroid && isStandalone && 'getInstalledRelatedApps' in navigator) {
      let isMounted = true;
      navigator.getInstalledRelatedApps()
        .then(relatedApps => {
          if (!isMounted) return;
          
          const isAppInstalled = relatedApps.some(app => 
            app.platform === 'play' && app.id === 'dev.pages.mindos.twa'
          );

          if (isAppInstalled) {
            sessionStorage.setItem("mindos_is_twa", "true");
            setState({ isTWA: true, isLoading: false });
          } else {
            setState({ isTWA: false, isLoading: false });
          }
        })
        .catch(err => {
          if (isMounted) setState({ isTWA: false, isLoading: false });
        });
        
      return () => { isMounted = false; };
    }

    // If not Android or not Standalone, it's a regular browser
    setState({ isTWA: false, isLoading: false });
  }, []);

  return state;
}
