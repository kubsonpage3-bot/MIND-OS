import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import toast from 'react-hot-toast';

/**
 * Custom hook for Pomodoro features.
 * Adheres to SSOT Law: Backend is the source of truth for history/stats.
 * State Sync Protocol: Invalidates queries on successful mutations.
 */
export function usePomodoro() {
  const queryClient = useQueryClient();

  // 1. Fetch Heatmap Data
  const {
    data: heatmapData,
    isLoading: isHeatmapLoading,
    error: heatmapError,
  } = useQuery({
    queryKey: ['pomodoro', 'heatmap'],
    queryFn: () => djangoApi.pomodoro.getHeatmap(365),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // 2. Fetch Stats
  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['pomodoro', 'stats'],
    queryFn: () => djangoApi.pomodoro.getStats(),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Fetch Recent Sessions (History)
  const {
    data: sessionsData,
    isLoading: isSessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ['pomodoro', 'sessions'],
    queryFn: () => djangoApi.pomodoro.getSessions(),
    staleTime: 5 * 60 * 1000,
  });

  // 4. Save completed session
  const saveSessionMutation = useMutation({
    mutationFn: (sessionData) => djangoApi.pomodoro.saveSession(sessionData),
    onSuccess: () => {
      // Phase 2: State Synchronization Protocol (NO ZOMBIE CACHES)
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'sessions'] });
      
      // If pomodoros give generic character XP later, invalidate 'player-stats' here.
      // Currently, it's a standalone system.
    },
    onError: (error) => {
      console.error('Failed to save Pomodoro session:', error);
      toast.error('Failed to save session. It might not appear in history.');
    },
  });

  return {
    heatmapData,
    isHeatmapLoading,
    heatmapError,

    statsData,
    isStatsLoading,
    statsError,

    sessionsData,
    isSessionsLoading,
    sessionsError,

    saveSession: saveSessionMutation.mutate,
    isSaving: saveSessionMutation.isPending,
  };
}
