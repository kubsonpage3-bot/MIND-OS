export const SUB_TABS = {
  character: ["overview", "skills", "achievements", "shop"],
  settings: [
    "appearance",
    "notifications",
    "account",
    "gameplay",
    "guides",
    "changelog",
    "reset",
    "about"
  ]
};

/**
 * Checks if a sub-tab is valid for a given section.
 * @param {string} section
 * @param {string|null} subTab
 * @returns {boolean}
 */
export function isValidSubTab(section, subTab) {
  if (!subTab) return false;
  const validSubs = SUB_TABS[section];
  if (!validSubs) return false;
  return validSubs.includes(subTab);
}

/**
 * Resolves the valid sub-tab for a section. Defaults to the first tab or null.
 * @param {string} section
 * @param {string|null} subTab
 * @returns {string|null}
 */
export function getValidSubTab(section, subTab) {
  if (isValidSubTab(section, subTab)) {
    return subTab;
  }
  const defaults = SUB_TABS[section];
  return defaults ? defaults[0] : null;
}
