import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { rawTasksQueryKey } from '@/constants/queryKeys';

const DISMISS_COOLDOWN_MS = 48 * 60 * 60 * 1000; // 48 hours
const GLOBAL_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour

export function useGameplayInsights() {
  const { profile } = useDjangoAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());

  // Auto-refresh the 'now' timestamp every minute so cooldowns properly expire
  // and insights reappear if the app is left open.
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch combat encounters (boss)
  const { data: encountersData } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
    enabled: !!profile,
  });

  // Fetch tasks (using a distinct queryKey to avoid clashing with Dashboard's mapped ["tasks"] query)
  const { data: tasksData } = useQuery({
    queryKey: rawTasksQueryKey('raw'),
    queryFn: djangoApi.tasks.list,
    enabled: !!profile,
  });

  const { mutate: dismissInsight } = useMutation({
    mutationFn: (insightId) => {
      if (!profile) return Promise.resolve();
      
      const currentTimeStr = new Date().toISOString();
      const currentDismissed = profile.dismissed_insights || {};
      
      return djangoApi.profile.update({
        dismissed_insights: {
          ...currentDismissed,
          [insightId]: currentTimeStr
        },
        last_insight_dismissed_at: currentTimeStr
      });
    },
    onMutate: async (insightId) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['userprofile'] });
      
      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData(['userprofile']);
      
      // Optimistically update to new value
      if (previousProfile) {
        const currentTimeStr = new Date().toISOString();
        queryClient.setQueryData(['userprofile'], {
          ...previousProfile,
          dismissed_insights: {
            ...(previousProfile.dismissed_insights || {}),
            [insightId]: currentTimeStr
          },
          last_insight_dismissed_at: currentTimeStr
        });
      }
      
      return { previousProfile };
    },
    onError: (err, newTodo, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(['userprofile'], context.previousProfile);
      }
    },
    onSettled: () => {
      // Always refetch after error or success to ensure sync
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
    }
  });

  const activeInsight = useMemo(() => {
    if (!profile) return null;

    // Check global grace period
    if (profile.last_insight_dismissed_at) {
      const lastDismissedTime = new Date(profile.last_insight_dismissed_at).getTime();
      if (now - lastDismissedTime < GLOBAL_GRACE_PERIOD_MS) {
        return null; // Don't show any insights during the grace period
      }
    }

    const dismissed = profile.dismissed_insights || {};
    const isDismissed = (id) => {
      const dismissTimeStr = dismissed[id];
      if (!dismissTimeStr) return false;
      const dismissTime = new Date(dismissTimeStr).getTime();
      return (now - dismissTime) < DISMISS_COOLDOWN_MS;
    };

    const encounters = Array.isArray(encountersData) ? encountersData : (encountersData?.results || []);
    const tasks = Array.isArray(tasksData) ? tasksData : (tasksData?.results || []);

    // 1. Prestige Eligibility
    if (profile.rank_info && (profile.rank_info.rank === 'SSS' || profile.rank_xp >= profile.prestige_xp_required)) {
      if (!isDismissed('prestige')) {
        return {
          id: 'prestige',
          icon: '⭐',
          title: 'insights.prestige.title',
          description: 'insights.prestige.description',
          cta: 'insights.prestige.cta',
          targetApp: 'mind',
          targetSection: 'character',
          targetSub: 'overview'
        };
      }
    }

    // 2. No Active Boss
    if (encounters.length === 0) {
      if (!isDismissed('no_boss')) {
        return {
          id: 'no_boss',
          icon: '👹',
          title: 'insights.no_boss.title',
          description: 'insights.no_boss.description',
          cta: 'insights.no_boss.cta',
          targetApp: 'mind',
          targetSection: 'character',
          targetSub: 'shop',
          targetShopTab: 'scrolls'
        };
      }
    }

    // 3. Unspent Skill Points
    if (profile.skill_points > 0) {
      if (!isDismissed('unspent_sp')) {
        return {
          id: 'unspent_sp',
          icon: '🧬',
          title: 'insights.unspent_sp.title',
          description: 'insights.unspent_sp.description',
          cta: 'insights.unspent_sp.cta',
          targetApp: 'mind',
          targetSection: 'character',
          targetSub: 'skills'
        };
      }
    }

    // 4. Streak / Dailies at Risk
    const currentHour = new Date().getHours();
    const hasUnfinishedDailies = tasks.some(t => {
      const isDaily = t.type === 'daily' || t.task_type === 'daily';
      const isCompleted = t.is_completed || t.completed || t.done || false;
      return isDaily && !isCompleted;
    });
    if (currentHour >= 20 && hasUnfinishedDailies) {
      if (!isDismissed('dailies_risk')) {
        return {
          id: 'dailies_risk',
          icon: '⚠️',
          title: 'insights.dailies_risk.title',
          description: 'insights.dailies_risk.description',
          cta: 'insights.dailies_risk.cta',
          targetApp: 'mind',
          targetSection: 'tasks',
          targetSub: 'dailies'
        };
      }
    }

    // 5. Zero Active Mutators
    const mutators = Array.isArray(profile.active_mutators) ? profile.active_mutators : [];
    if (mutators.length === 0 && profile.level >= 3) {
      if (!isDismissed('no_mutators')) {
        return {
          id: 'no_mutators',
          icon: '🧪',
          title: 'insights.no_mutators.title',
          description: 'insights.no_mutators.description',
          cta: 'insights.no_mutators.cta',
          targetApp: 'mind',
          targetSection: 'character',
          targetSub: 'shop',
          targetShopTab: 'mutators'
        };
      }
    }

    // 6. Empty Ally Slots
    const allies = Array.isArray(profile.active_allies) ? profile.active_allies : [];
    if (allies.length === 0) {
      if (!isDismissed('no_allies')) {
        return {
          id: 'no_allies',
          icon: '🤝',
          title: 'insights.no_allies.title',
          description: 'insights.no_allies.description',
          cta: 'insights.no_allies.cta',
          targetApp: 'mind',
          targetSection: 'character',
          targetSub: 'shop',
          targetShopTab: 'allies'
        };
      }
    }

    // 7. Excess Wealth (Hoarding)
    if (profile.gold > 15000) {
      if (!isDismissed('excess_gold')) {
        return {
          id: 'excess_gold',
          icon: '💰',
          title: 'insights.excess_gold.title',
          description: 'insights.excess_gold.description',
          cta: 'insights.excess_gold.cta',
          targetApp: 'mind',
          targetSection: 'character',
          targetSub: 'shop'
        };
      }
    }

    // 8. Rival Discovery
    const seenGuides = Array.isArray(profile.seen_guides) ? profile.seen_guides : [];
    if (!seenGuides.includes('rival')) {
      if (!isDismissed('rival_discovery')) {
        return {
          id: 'rival_discovery',
          icon: '🤺',
          title: 'insights.rival_discovery.title',
          description: 'insights.rival_discovery.description',
          cta: 'insights.rival_discovery.cta',
          targetApp: 'mind',
          targetSection: 'rival'
        };
      }
    }

    return null;
  }, [profile, encountersData, tasksData, now]);

  return { activeInsight, dismissInsight };
}
