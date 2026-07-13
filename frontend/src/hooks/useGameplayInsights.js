import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { useDjangoAuth } from '@/lib/DjangoAuthContext';

const DISMISS_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

// Safe localStorage wrapper
function getDismissedInsights() {
  try {
    const raw = localStorage.getItem('mindos_dismissed_insights');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setDismissedInsight(insightId) {
  try {
    const dismissed = getDismissedInsights();
    dismissed[insightId] = Date.now();
    localStorage.setItem('mindos_dismissed_insights', JSON.stringify(dismissed));
  } catch (e) {
    // Ignore
  }
}

export function useGameplayInsights() {
  const { profile } = useDjangoAuth();
  const [dismissed, setDismissed] = useState(getDismissedInsights);

  // Auto-refresh dismissed state every minute so cool-down properly expires
  useEffect(() => {
    const interval = setInterval(() => {
      setDismissed(getDismissedInsights());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch combat encounters (boss)
  const { data: encountersData } = useQuery({
    queryKey: ['combat_encounters'],
    queryFn: djangoApi.combat.getEncounters,
    enabled: !!profile,
  });

  // Fetch tasks
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: djangoApi.tasks.list,
    enabled: !!profile,
  });

  const activeInsight = useMemo(() => {
    if (!profile) return null;

    const encounters = Array.isArray(encountersData) ? encountersData : (encountersData?.results || []);
    const tasks = Array.isArray(tasksData) ? tasksData : (tasksData?.results || []);

    const now = Date.now();
    const isDismissed = (id) => {
      const dismissTime = dismissed[id];
      if (!dismissTime) return false;
      return (now - dismissTime) < DISMISS_COOLDOWN_MS;
    };

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
          targetSub: 'shop'
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
    const hasUnfinishedDailies = tasks.some(t => t.type === 'daily' && !t.completed);
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
    const mutators = profile.active_mutators || [];
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
          targetSub: 'shop'
        };
      }
    }

    // 6. Empty Ally Slots
    const allies = profile.active_allies || [];
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
          targetSub: 'allies'
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
    const seenGuides = profile.seen_guides || [];
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
  }, [profile, encountersData, tasksData, dismissed]);

  const dismissInsight = (id) => {
    setDismissedInsight(id);
    setDismissed(getDismissedInsights());
  };

  return { activeInsight, dismissInsight };
}
