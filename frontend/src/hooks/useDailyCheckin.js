import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';

export function useDailyCheckin() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['daily-checkin'],
    queryFn: () => djangoApi.dailyCheckin.get(),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (completedIds) => djangoApi.dailyCheckin.submit(completedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['daily-checkin'] });
    },
  });

  const needsCheckin = query.data?.needs_checkin === true;
  const dailies = query.data?.dailies || [];

  return {
    needsCheckin,
    dailies,
    isLoading: query.isLoading,
    submitCheckin: mutation.mutate,
    isSubmitting: mutation.isPending,
    submitResult: mutation.data,
  };
}
