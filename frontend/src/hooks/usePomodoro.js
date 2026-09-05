// @ts-nocheck
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
  /** @type {import('@tanstack/react-query').UseMutationResult<any, any, any, any>} */
  const saveSessionMutation = useMutation({
    mutationFn: (sessionData) => djangoApi.pomodoro.saveSession(sessionData),
    onSuccess: (data) => {
      // Phase 2: State Synchronization Protocol (NO ZOMBIE CACHES)
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      // NOTE: the Activities/Training tab reads its per-subject hours from the
      // ["trainingLogs"] query (Dashboard.jsx) and the History tab from
      // ["activityHistory"] (HistoryLog.jsx) — invalidate those exact keys,
      // not the nonexistent ["training_sessions"]/["logs"] that used to be
      // here (they matched no query, so this invalidation was a no-op and
      // the Activities panel could lag up to its 5min staleTime).
      queryClient.invalidateQueries({ queryKey: ['trainingLogs'] });
      queryClient.invalidateQueries({ queryKey: ['activityHistory'] });
    },
    onError: (error) => {
      console.error('Failed to save Pomodoro session:', error);
      toast.error('Failed to save session. It might not appear in history.');
    },
  });

  // 5. Active Pomodoro Session Sync
  const {
    data: activeSession,
    isLoading: isActiveSessionLoading,
  } = useQuery({
    queryKey: ['pomodoro', 'active-session'],
    queryFn: () => djangoApi.pomodoro.getActiveSession(),
    refetchInterval: 10_000, // Sync every 10s
  });

  const startActiveSessionMutation = useMutation({
    mutationFn: (data) => djangoApi.pomodoro.startActiveSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });
    },
  });

  const pauseActiveSessionMutation = useMutation({
    mutationFn: () => djangoApi.pomodoro.pauseActiveSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });
    },
  });

  const resetActiveSessionMutation = useMutation({
    mutationFn: () => djangoApi.pomodoro.resetActiveSession(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });
    },
  });

  const completeActiveSessionMutation = useMutation({
    mutationFn: (data) => djangoApi.pomodoro.completeActiveSession(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['pomodoro', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
      // See note above: this is a linked-activity completion, so it just
      // created/updated a TrainingSession — the Activities tab's hour totals
      // and rank bars won't reflect it without invalidating the real query
      // keys those views actually use.
      queryClient.invalidateQueries({ queryKey: ['trainingLogs'] });
      queryClient.invalidateQueries({ queryKey: ['activityHistory'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (data?.gold_earned && data?.xp_earned) {
        toast.success(`Focus logged! +${data.xp_earned} XP, +${data.gold_earned}G`);
      }
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

    activeSession,
    isActiveSessionLoading,
    startActiveSession: startActiveSessionMutation.mutate,
    pauseActiveSession: pauseActiveSessionMutation.mutate,
    resetActiveSession: resetActiveSessionMutation.mutate,
    completeActiveSession: completeActiveSessionMutation.mutate,

    saveSession: saveSessionMutation.mutate,
    isSaving: saveSessionMutation.isPending,
  };
}
