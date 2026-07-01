# SSOT AUDIT: LEGACY LOCALSTORAGE & OFFLINE ENGINES DEPRECATION

This document tracks all violations of the Single Source of Truth (SSOT) architecture across the React frontend. It serves as the scope document for the large follow-up task to completely rip out the legacy offline-first game engine and migrate all state strictly to the Django API.

---

## 1. Full List of Parallel/Legacy Engines

### A. `taskEngine.js` (`frontend/src/lib/taskEngine.js`)
* **What it currently does:** It was the original offline engine for managing Tasks, HP, Mana, and Gold. It calculates base task values, processes difficulty multipliers, runs a local cron to check for missed dailies, and applies death penalties locally.
* **Is it actively used?** Yes. It actively fights the Django backend. Components still call its helpers (`calcNewValue`, `getTaskValueColor`, `getLckStat`) and it triggers `queueAutoSync()` whenever a local modification occurs via `saveGS()`.
* **LocalStorage Keys:** Reads/Writes `mindos_game_state`, `mindos_tasks`, `mindos_class`, `mindos_last_daily_cron`.

### B. `mutatorEngine.js` (`frontend/src/lib/mutatorEngine.js`)
* **What it currently does:** It runs a daily tick (`runDailyMutatorTick()`) to apply passive effects (like Loan Shark interest deductions or Compound Interest gains). It also modifies boss damage dynamically via `applyBossDamageModifiers()` based on active mutators. 
* **Is it actively used?** Yes. `Dashboard.jsx` explicitly fires its daily tick on mount, directly modifying local HP/Gold without Django's knowledge.
* **LocalStorage Keys:** Reads/Writes `mindos_mutators`, `mindos_game_state`, `mindos_class`.

### C. `rpgSystem.js` (`frontend/src/lib/rpgSystem.js`)
* **What it currently does:** It acts as the database for static game data (Classes, Achievements, Mutators, Skill Trees) BUT it also manages local state saving via `loadRPGData` and `saveRPGData`. It contains hardcoded thresholds for Rank mapping and XP boundaries.
* **Is it actively used?** Yes. Heavily imported across the application. Many UI components rely on its exported constants for rendering (e.g., `CLASS_SPRITES`), but they also use its `load/save` wrappers to persist game progress locally.
* **LocalStorage Keys:** Reads/Writes `mindos_game_state`, `mindos_achievements`, `mindos_skill_tree`, `mindos_allies`, `mindos_mutators`, `mindos_prestige`.

### D. `cloudSync.js` (`frontend/src/lib/cloudSync.js`)
* **What it currently does:** Houses the `queueAutoSync()` debouncer. Previously, it pushed all `localStorage` state to a cloud bucket. Now, the `Dashboard.jsx` component hijack's this local state and injects it into Django API calls.
* **LocalStorage Keys:** Iterates over a dictionary of ALL `mindos_` keys.

### E. `RivalTab.jsx` (Isolated Sub-Engine)
* **What it currently does:** Acts as an independent parallel engine for the Rival feature. It calculates rival XP, rival streak, and subject weights purely on the client side, completely bypassing the backend logic.
* **Is it actively used?** Yes, every time the user opens the Rival tab, it recalculates state and overwrites the local cache.
* **LocalStorage Keys:** Reads/Writes `rival_data` independently from `mindos_game_state`.

---

## 2. Full Import Graph (Dependencies)

Every file listed below currently imports from one of the legacy engines and will need to be refactored to read from the Django `UserProfile` response (via React Query) instead.

### Files importing `taskEngine.js`:
- `frontend/src/components/mindos/DailiesColumn.jsx`
- `frontend/src/components/mindos/HabitsColumn.jsx`
- `frontend/src/components/mindos/TodosColumn.jsx`

### Files importing `mutatorEngine.js`:
- `frontend/src/pages/Dashboard.jsx` (Calls `runDailyMutatorTick` and `applySessionMutators`)
- `frontend/src/components/mindos/DailiesColumn.jsx` (Calls `applyBossDamageModifiers`)
- `frontend/src/components/mindos/HabitsColumn.jsx` (Calls `applyBossDamageModifiers`)
- `frontend/src/components/mindos/TodosColumn.jsx` (Calls `applyBossDamageModifiers`)

### Files importing `rpgSystem.js`:
**For State Management (`loadRPGData`, `saveRPGData`):**
- `frontend/src/pages/Achievements.jsx`
- `frontend/src/components/mindos/AlliesPanel.jsx`
- `frontend/src/components/mindos/CharacterTab.jsx`
- `frontend/src/components/mindos/MutatorsPanel.jsx`
- `frontend/src/components/mindos/PrestigePanel.jsx`
- `frontend/src/components/mindos/SkillTreePanel.jsx`

**For Static Constants (`CLASSES`, `CLASS_SPRITES`, `ACHIEVEMENTS`, etc):**
- `frontend/src/pages/Achievements.jsx`
- `frontend/src/components/mindos/CharacterHub.jsx`
- `frontend/src/components/mindos/ClassSelector.jsx`
- `frontend/src/components/mindos/SkillPanel.jsx`
- `frontend/src/components/mindos/PixelCharacter.jsx`
- `frontend/src/components/navigation/CharacterStatusBar.jsx`
- `frontend/src/components/mindos/CharacterTab.jsx`

---

## 3. Remediation Strategy for the Follow-up Task
1. **Move Constants:** Extract `CLASSES`, `CLASS_SPRITES`, `ACHIEVEMENTS`, etc. from `rpgSystem.js` into a pure stateless configuration file (e.g., `constants/rpgData.js`).
2. **Remove Local Computation:** Delete `taskEngine.js` and `mutatorEngine.js`. Move any remaining boss damage modifier logic or daily interest calculations strictly to the Django backend (`api/services/combat_service.py` or daily Celery cron).
3. **Purge LocalStorage Wrappers:** Remove all instances of `loadGS`, `saveGS`, `loadRPGData`, `saveRPGData`. The UI must blindly render what `useQuery(['userprofile'])` returns.
4. **Kill Auto-Sync:** Remove `cloudSync.js` entirely. Delete the `Dashboard.jsx` `useEffect` blocks that read `localStorage` and `djangoApi.profile.update()` them.

## 4. Deferred Server-Side Mutators
The following daily-tick mutators are NOT currently active for any user and have not been implemented in the `daily_mutator_tick.py` backend cron. **Do not enable these mutators for users until their backend logic is built:**
- `miser`: Each 24h without spending: +5 Rank XP.
- `ascetic_loop`: Streak gives Rank XP: streak×0.2 per day.
- `momentum`: Each day with 1h+ logged: +2% Rank XP. Miss: resets.
- `diversity_lock`: +20% Rank XP for 30d (duration tracking).
- `silence`: All skills disabled 48h (duration tracking).
- `zero_hour`: No Gold earned for 7 days. After: get back 3× (duration/state tracking).
- `phantom_load`: Yesterday's hours count as +30% today.
- `deja_vu`: Same subject 3 days in a row: 3rd session +50%.

## 5. KNOWN EXCEPTION — Global Streak
`streak` (Dashboard multiplier, StreakControl widget, achievement unlocks, cognitiveEngine efficiency boost) remains localStorage-backed via lifeOS.js/gameState.js. This is intentionally NOT migrated in this pass. 

This becomes a scoped item for the future lifeOS.js migration task: build current_streak/max_streak on UserProfile, wire up increment-on-first-activity-of-day and break-on-missed-day cron logic, and migrate each user's current localStorage streak value into the backend field once (one-time migration script) before the frontend stops reading localStorage for it.
