import { useQueryClient, useQuery } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';

/**
 * Single source of truth for user profile data.
 * Subscribes to the shared ['userprofile'] React Query cache.
 * Never polls localStorage for HP/Mana/Gold - use this hook instead.
 */
export function useProfileSync() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['userprofile'],
    queryFn: djangoApi.profile.get,
    enabled: false,
    staleTime: Infinity,
  });

  /**
   * Optimistically patch the profile cache after a mutation.
   * @param {object} patch - Partial profile fields to merge
   */
  const syncProfile = (patch) => {
    queryClient.setQueryData(['userprofile'], (/** @type {any} */ old) => {
      if (!old) return old;
      return { ...old, ...patch };
    });
  };

  /**
   * Force a fresh fetch from the backend.
   */
  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: ['userprofile'] });
  };

  return { profile: profile ?? null, syncProfile, invalidateProfile };
}
