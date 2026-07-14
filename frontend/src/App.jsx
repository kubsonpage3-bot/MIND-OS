import { useEffect, useState } from "react";
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import AppShell from '@/components/AppShell';
import Achievements from "./pages/Achievements";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SelectClass from "./pages/SelectClass";
import TestSwipe from "./pages/TestSwipe";
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';
import AnalyticsMigrationGate from '@/components/AnalyticsMigrationGate';
import ConsentBanner from '@/components/mindos/ConsentBanner';
import { native, isNative } from '@/lib/NativeServices';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';

// Fix white status bar on Android (Capacitor)
if (isNative) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark });
    StatusBar.setBackgroundColor({ color: '#0a0a0f' });
  }).catch(() => {});
}

function useSystemTheme() {
  useEffect(() => {
    async function loadTheme() {
      try {
        let themeSetting = null;
        if (isNative) {
          const { value } = await Preferences.get({ key: 'mindos_settings' });
          if (value) {
            const saved = JSON.parse(value);
            themeSetting = saved.theme;
          }
        } else {
          const saved = JSON.parse(localStorage.getItem("mindos_settings") || "{}");
          themeSetting = saved.theme;
        }

        if (themeSetting) return;
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) {
          const newSettings = { theme: "dark" };
          if (isNative) {
            await Preferences.set({ key: 'mindos_settings', value: JSON.stringify(newSettings) });
          } else {
            localStorage.setItem("mindos_settings", JSON.stringify(newSettings));
          }
          document.documentElement.setAttribute("data-theme", "dark");
        }
      } catch (e) {
        console.warn('Theme load failed', e);
      }
    }
    loadTheme();
  }, []);
}

function ProtectedRoutes() {
  const { profile, isLoading } = useDjangoAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const needsSetup = !profile?.character_class || profile.character_class === "Wanderer";
  if (needsSetup && location.pathname !== '/select-class') {
    return <Navigate to="/select-class" replace />;
  }

  return (
    <>
      <AnalyticsMigrationGate />
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/Dashboard" element={<AppShell defaultTab="mind" />} />
        <Route path="/LifeOS" element={<AppShell defaultTab="life" />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/select-class" element={<SelectClass />} />
        <Route path="/test-swipe" element={<TestSwipe />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default function App() {
  useSystemTheme();
  const { isAuthenticated, isLoading } = useDjangoAuth();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    native.lockOrientation();
    
    if (isNative) {
      const logCurrentNetworkStatus = async () => {
        const status = await Network.getStatus();
        setIsOffline(!status.connected);
      };
      logCurrentNetworkStatus();
      
      const listener = Network.addListener('networkStatusChange', status => {
        setIsOffline(!status.connected);
      });
      
      return () => {
        listener.then(l => l.remove());
      };
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      native.hideSplashScreen();
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (isOffline) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-950 text-white z-[9999]">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 2 20 20"/><path d="M8.53 8.53a8.97 8.97 0 0 0-4.04 1.95L2 8a13.3 13.3 0 0 1 7.2-3.15"/><path d="M16 4.31a13.2 13.2 0 0 1 6 3.69l-2.48 2.48a9.8 9.8 0 0 0-4.49-2.31"/><path d="M13.73 13.73a4.9 4.9 0 0 0-3.32-1.2 4.9 4.9 0 0 0-3.34 1.25L4.59 11.3a8.88 8.88 0 0 1 5.4-2.22"/><path d="M16.92 11.3a8.86 8.86 0 0 1 2.49 2.48"/><path d="m9.67 15.34-1.2-1.2a2.86 2.86 0 0 0-1.4 1.63"/><path d="m15.65 15.66-1.21-1.21"/><path d="M12 20h.01"/></svg>
        </div>
        <h2 className="text-xl font-bold mb-2">No Connection</h2>
        <p className="text-slate-400">Waiting for network...</p>
      </div>
    );
  }

  return (
    <>
      <ConsentBanner />
      {!isAuthenticated ? (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      ) : (
        <ProtectedRoutes />
      )}
    </>
  );
}
