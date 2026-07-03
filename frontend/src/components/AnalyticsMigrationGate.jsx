import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { queryClientInstance } from '@/lib/query-client';

export default function AnalyticsMigrationGate() {
  const { profile } = useDjangoAuth();

  const updateProfile = useMutation({
    mutationFn: ({ data }) => djangoApi.profile.update(data),
    onSuccess: () => {
      // Must use queryClientInstance to invalidate
      queryClientInstance.invalidateQueries({ queryKey: ["userprofile"] });
    },
  });

  useEffect(() => {
    // Only run if we have a valid authenticated profile loaded
    if (!profile || !profile.id) return;
    
    // Check if the migration was already completed on this device
    const hasMigrated = localStorage.getItem("mindos_analytics_migrated");
    if (hasMigrated) return;

    try {
      const localPrivacy = JSON.parse(localStorage.getItem("mindos_privacy") || "{}");
      
      // If the user explicitly opted out locally, sync that choice to the backend
      if (localPrivacy.analyticsEnabled === false) {
        updateProfile.mutate({ 
          data: { analytics_enabled: false } 
        }, {
          onSuccess: () => {
            // Mark as migrated ONLY on success to guarantee the choice is saved
            localStorage.setItem("mindos_analytics_migrated", "true");
          },
          onError: (err) => {
            console.error("Failed to migrate analytics opt-out to backend:", err);
            // We do not mark as migrated on error, so it retries next time
          }
        });
      } else {
        // If they didn't opt out (was true or undefined), the backend default of True is correct.
        // We just mark as migrated.
        localStorage.setItem("mindos_analytics_migrated", "true");
      }
    } catch (err) {
      // If JSON parsing fails (corrupted data), mark migrated to avoid infinite retry loops
      localStorage.setItem("mindos_analytics_migrated", "true");
    }
  }, [profile?.id]);

  // This is a headless logic component
  return null;
}
