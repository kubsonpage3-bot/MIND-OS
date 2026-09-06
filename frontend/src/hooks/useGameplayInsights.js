// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';
import { rawTasksQueryKey } from '@/constants/queryKeys';

// Cooldown after user closes a specific insight (7 days instead of 48h)
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
// Global quiet period after closing any insight (2 hours instead of 1h)
const GLOBAL_GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;
// Initial quiet delay on app startup before showing any toast (5 seconds)
const INITIAL_STARTUP_DELAY_MS = 5000;

export function useGameplayInsights() {
  const { profile } = useDjangoAuth();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [mountedAt] = useState(Date.now());

  // Auto-refresh the 'now' timestamp every 15s so countdowns and cooldowns work seamlessly
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 15000);
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
      await queryClient.cancelQueries({ queryKey: ['userprofile'] });
      const previousProfile = queryClient.getQueryData(['userprofile']);
      
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
      queryClient.invalidateQueries({ queryKey: ['userprofile'] });
    }
  });

  const activeInsight = useMemo(() => {
    if (!profile) return null;

    // 0. Suppress all gameplay insight cards during onboarding and for new users
    if (!profile.seen_guides?.["main_tutorial"] || !profile.seen_guides?.["welcome_splash"]) {
      return null;
    }
    if ((profile.level || 1) < 2 && (profile.streak || 0) === 0) {
      return null;
    }

    // 1. Initial startup grace period (prevent instant popup on app open)
    if (now - mountedAt < INITIAL_STARTUP_DELAY_MS) {
      return null;
    }

    // 2. Check global quiet grace period after any dismissed insight
    if (profile.last_insight_dismissed_at) {
      const lastDismissedTime = new Date(profile.last_insight_dismissed_at).getTime();
      if (now - lastDismissedTime < GLOBAL_GRACE_PERIOD_MS) {
        return null;
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
          category: 'ascension',
          badge: '👑 ASCENSION',
          color: '#fbbf24',
          icon: '👑',
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
          category: 'boss',
          badge: '👹 BOSS ENCOUNTER',
          color: '#f87171',
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
          category: 'skills',
          badge: '⚡ SKILL TREE',
          color: '#a78bfa',
          icon: '⚡',
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
          category: 'dailies',
          badge: '⚠️ STREAK ALERT',
          color: '#f59e0b',
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
          category: 'mutators',
          badge: '🧪 MUTATORS',
          color: '#34d399',
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
          category: 'allies',
          badge: '🤝 PARTY SQUAD',
          color: '#60a5fa',
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
          category: 'treasury',
          badge: '💰 TREASURY',
          color: '#fbbf24',
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
          category: 'rival',
          badge: '⚔️ RIVAL DISCOVERY',
          color: '#c084fc',
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
  }, [profile, encountersData, tasksData, now, mountedAt]);

  return { activeInsight, dismissInsight };
}
