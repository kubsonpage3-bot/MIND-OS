# FULL RETIREMENT OF LEGACY OFFLINE ENGINES

This plan executes the complete removal of the parallel offline engines (`taskEngine.js`, `mutatorEngine.js`, `rpgSystem.js`, `cloudSync.js`, and local `rival_data`). It transitions the frontend to rely strictly on React Query (`['userprofile']`) and delegates all game state computations to the Django backend.

## Step 1 — Extract pure constants (lowest risk)
Create `frontend/src/constants/rpgData.js` to store pure visual/config constants from `rpgSystem.js` (`CLASSES`, `CLASS_SPRITES`, `ACHIEVEMENTS`, `MUTATORS`, `ALLIES`, `SKILL_TREE`, `RANK_CHARACTER_FILTERS`).
- Update the import paths in:
  - `Achievements.jsx`
  - `CharacterHub.jsx`
  - `ClassSelector.jsx`
  - `SkillPanel.jsx`
  - `PixelCharacter.jsx`
  - `CharacterStatusBar.jsx`
  - `CharacterTab.jsx`
- *Verification: Ensure the app builds and all screens render sprites/labels correctly.*

## Step 2 — Kill auto-sync at the source
- Delete `frontend/src/lib/cloudSync.js`.
- Modify `frontend/src/pages/Dashboard.jsx`:
  - Remove all `useEffect` blocks that read `localStorage` and call `djangoApi.profile.update()`.
  - Remove `runDailyMutatorTick()` and `applySessionMutators()` on mount.
  - Rely exclusively on `useQuery(['userprofile'])` for character rendering.
- *Verification: Reset app, wait 5 minutes, refresh, and confirm the reset bug is truly eradicated.*

## Step 3 — Remove local computation from task columns
- In `DailiesColumn.jsx`, `HabitsColumn.jsx`, `TodosColumn.jsx`:
  - Remove all imports of `taskEngine.js` and `mutatorEngine.js`.
  - Replace local computed values (e.g., `getTaskValueColor`, `calcNewValue`) with pure cosmetic/display logic or fallback values.
  - Remove local boss damage modifiers (`applyBossDamageModifiers`); let the server handle modifiers completely.
- Delete `taskEngine.js` and `mutatorEngine.js` completely.
- *Verification: Complete a task and confirm rewards/UI still function based solely on the `res` payload from the Django API.*

> [!IMPORTANT]
> **Step 4 — Move Daily Mutators to Django (Review Required)**
> 
> **Current Scope (per user instructions):**
> 1. Add `active_mutators = models.JSONField(default=list, blank=True)` to `UserProfile`.
> 2. Create `backend/api/management/commands/daily_mutator_tick.py`.
> 3. Implement ONLY the three mutators currently active for users: `loan_shark`, `cursed_clock`, and `compound`.
> 
> **Calculation Approach & Order:**
> The command will loop through users with active mutators and process them inside `transaction.atomic()` using `select_for_update()`. The calculations will be done in Python memory and saved atomically per user to prevent race conditions.
> 
> The exact processing order will be:
> 1. **`loan_shark`**: Deduct 30G.
> 2. **`cursed_clock`**: Calculate idle hours between 8:00–22:00 (approximate or precise) and deduct 2G per idle hour.
> 3. **`compound`**: Add +1G per 100G owned based on the *remaining* balance after the previous deductions.
> 
> *Other daily mutators (~8) will NOT be implemented now. They will be documented in the audit file and deferred to a later task.*

## Step 5 — Remove remaining loadRPGData/saveRPGData usage
- Replace `loadRPGData` and `saveRPGData` with React Query (`useQuery`, `useMutation`) in:
  - `Achievements.jsx`
  - `AlliesPanel.jsx`
  - `CharacterTab.jsx`
  - `MutatorsPanel.jsx`
  - `PrestigePanel.jsx`
  - `SkillTreePanel.jsx`
- Delete `frontend/src/lib/rpgSystem.js`.

> [!WARNING]
> **API Gaps Identification:**
> Before removing `rpgSystem.js`, I will inspect `api/serializers.py` to ensure `UserProfile` actually exposes unlocked achievements, mutators, skills, allies, and prestige counts. If any are missing, I will add the necessary endpoints/fields to the Django API.

## Step 6 — Fix RivalTab.jsx
- Remove client-side calculation of `rival_data` (rival XP, streak, subject weights) from `RivalTab.jsx`.
- Create a new Django endpoint `GET /api/rival/` inside `backend/api/views.py` and a service in `backend/api/services/rival_service.py` to compute this data dynamically on the server.
- Update `RivalTab.jsx` to fetch this data via `useQuery(['rival_data'])`.

## Step 7 — Final verification
1. Run `grep` for `localStorage` to confirm zero remaining game-state keys.
2. Clean up the reset band-aid in `ResetPanel.jsx` (it's no longer necessary).
3. Run the complete `pytest` test suite and `npm run build`.
4. Provide a before/after list of `localStorage` footprint.
