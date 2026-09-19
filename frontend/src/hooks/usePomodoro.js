// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import toast from 'react-hot-toast';

// Error codes the timer handles itself (with its own, more specific UI) --
// the generic "failed" toast must not fire on top of them.
const HANDLED_COMPLETE_CODES = ['too_short', 'no_active_session'];

/**
 * Custom hook for Pomodoro features.
 * Adheres to SSOT Law: Backend is the source of truth for history/stats AND for
 * how long a session actually ran (rewards are computed server-side from its
 * own clock; the client never declares a duration).
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

  // 3. Fetch Recent Sessions (History) -- focus sessions only, enough rows for
  // the history/peak-hour views (the default page is just 25).
  const {
    data: sessionsData,
    isLoading: isSessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ['pomodoro', 'sessions'],
    queryFn: () => djangoApi.pomodoro.getSessions({ kind: 'work', page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  });

  const invalidateSessionData = () => {
    queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });
    queryClient.invalidateQueries({ queryKey: ['pomodoro', 'heatmap'] });
    queryClient.invalidateQueries({ queryKey: ['pomodoro', 'stats'] });
    queryClient.invalidateQueries({ queryKey: ['pomodoro', 'sessions'] });
    queryClient.invalidateQueries({ queryKey: ['userprofile'] });
    // NOTE: the Activities/Training tab reads its per-subject hours from the
    // ["trainingLogs"] query (Dashboard.jsx) and the History tab from
    // ["activityHistory"] (HistoryLog.jsx) — invalidate those exact keys.
    queryClient.invalidateQueries({ queryKey: ['trainingLogs'] });
    queryClient.invalidateQueries({ queryKey: ['activityHistory'] });
  };

  // 4. Active Pomodoro Session Sync. Always refetch on mount (the timer tab
  // unmounts when you leave it, and a cached snapshot minutes old would make
  // the restored countdown wrong) and when the window regains focus.
  const {
    data: activeSession,
    dataUpdatedAt: activeSessionUpdatedAt,
    isLoading: isActiveSessionLoading,
  } = useQuery({
    queryKey: ['pomodoro', 'active-session'],
    queryFn: () => djangoApi.pomodoro.getActiveSession(),
    refetchInterval: 10_000, // Sync every 10s
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const refreshActiveSession = () =>
    queryClient.invalidateQueries({ queryKey: ['pomodoro', 'active-session'] });

  const startActiveSessionMutation = useMutation({
    mutationFn: (data) => djangoApi.pomodoro.startActiveSession(data),
    onSuccess: (data) => {
      // Adopt the server's answer right away (the request is idempotent: if an
      // identical session was already running, this is ITS clock, not a reset).
      queryClient.setQueryData(['pomodoro', 'active-session'], data);
    },
    onError: (error) => {
      console.error('Failed to start Pomodoro session:', error);
      toast.error(error?.message || 'Could not start the timer on the server.');
      refreshActiveSession();
    },
  });

  const pauseActiveSessionMutation = useMutation({
    mutationFn: (action) => djangoApi.pomodoro.pauseActiveSession(action),
    onSuccess: (data) => {
      if (data?.active) queryClient.setQueryData(['pomodoro', 'active-session'], data);
      else refreshActiveSession();
    },
    onError: (error) => {
      console.error('Failed to pause/resume Pomodoro session:', error);
      refreshActiveSession();
    },
  });

  const resetActiveSessionMutation = useMutation({
    mutationFn: () => djangoApi.pomodoro.resetActiveSession(),
    onSuccess: () => {
      queryClient.setQueryData(['pomodoro', 'active-session'], { active: false });
    },
    onError: (error) => {
      console.error('Failed to reset Pomodoro session:', error);
      refreshActiveSession();
    },
  });

  const completeActiveSessionMutation = useMutation({
    mutationFn: (data) => djangoApi.pomodoro.completeActiveSession(data),
    onSuccess: (data) => {
      // The server consumed the session: reflect that immediately so a poll
      // that was already in flight can't resurrect it as "expired".
      queryClient.setQueryData(['pomodoro', 'active-session'], { active: false });
      invalidateSessionData();
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (data?.gold_earned && data?.xp_earned) {
        toast.success(`Focus logged! +${data.xp_earned} XP, +${data.gold_earned}G`);
      }
    },
    onError: (error) => {
      const code = error?.data?.code;
      if (HANDLED_COMPLETE_CODES.includes(code)) {
        // Expected: the caller shows a specific message. A "no active session"
        // means another tab/device already completed it -- just resync.
        if (code === 'no_active_session') {
          queryClient.setQueryData(['pomodoro', 'active-session'], { active: false });
        } else {
          refreshActiveSession();
        }
        return;
      }
      console.error('Failed to complete Pomodoro session:', error);
      toast.error('Failed to log focus session. Please check your connection.');
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
    activeSessionUpdatedAt,
    isActiveSessionLoading,
    startActiveSession: startActiveSessionMutation.mutate,
    pauseActiveSession: () => pauseActiveSessionMutation.mutate('pause'),
    resumeActiveSession: () => pauseActiveSessionMutation.mutate('resume'),
    resetActiveSession: resetActiveSessionMutation.mutate,
    completeActiveSession: completeActiveSessionMutation.mutate,
    completeActiveSessionAsync: completeActiveSessionMutation.mutateAsync,
    isCompleting: completeActiveSessionMutation.isPending,
  };
}
