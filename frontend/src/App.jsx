import { useEffect } from "react";
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
import { Toaster } from '@/components/ui/toaster';
import { Loader2 } from 'lucide-react';

function useSystemTheme() {
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("mindos_settings") || "{}");
      if (saved.theme) return;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        const settings = { ...saved, theme: "dark" };
        localStorage.setItem("mindos_settings", JSON.stringify(settings));
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch {}
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
      <Routes>
        <Route path="/" element={<AppShell />} />
        <Route path="/Dashboard" element={<AppShell defaultTab="mind" />} />
        <Route path="/LifeOS" element={<AppShell defaultTab="life" />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/select-class" element={<SelectClass />} />
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

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <ProtectedRoutes />;
}
