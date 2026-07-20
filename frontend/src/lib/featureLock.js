/**
 * Feature Lock System — rank-string-based gating.
 *
 * SSOT: uses profile.rank_info.current_id (computed server-side by get_rank_info).
 * This respects all per-player threshold reductions (Kira passive, endurance_protocol, etc.)
 * because it compares the FINAL computed rank string, not raw XP.
 *
 * Unlock thresholds:
 *  - Skills: Unlocks at Rank D or higher (current_id !== "E")
 *  - Allies: Unlocks at Rank C or higher (current_id !== "E" && current_id !== "D")
 *  - Mutators: Unlocks at Rank C or higher (current_id !== "E" && current_id !== "D")
 */

const RANK_ORDER = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'ASC'];

/**
 * Returns -1, 0, or 1 like a comparator.
 * @param {string} rankA
 * @param {string} rankB
 */
function compareRanks(rankA, rankB) {
  const ia = RANK_ORDER.indexOf(rankA);
  const ib = RANK_ORDER.indexOf(rankB);
  if (ia === -1 || ib === -1) return 0;
  if (ia === ib) return 0;
  return ia < ib ? -1 : 1;
}

/**
 * Returns true if currentRank is strictly lower than requiredRank.
 * @param {string} currentRank - e.g. "E"
 * @param {string} requiredRank - e.g. "D"
 */
export function isFeatureLocked(currentRank, requiredRank) {
  return compareRanks(currentRank, requiredRank) < 0;
}

/**
 * Derive lock state from profile.rank_info or profile.rank.
 * @param {any} profile
 * @returns {{ currentRank: string, skillsLocked: boolean, alliesLocked: boolean, mutatorsLocked: boolean, skillsUnlockRank: string, alliesUnlockRank: string, mutatorsUnlockRank: string }}
 */
export function getFeatureLocks(profile) {
  const currentRank = profile?.rank_info?.current_id || profile?.rank || 'E';

  return {
    currentRank,
    skillsLocked: isFeatureLocked(currentRank, 'D'),
    alliesLocked: isFeatureLocked(currentRank, 'C'),
    mutatorsLocked: isFeatureLocked(currentRank, 'C'),
    skillsUnlockRank: 'D',
    alliesUnlockRank: 'C',
    mutatorsUnlockRank: 'C',
  };
}
