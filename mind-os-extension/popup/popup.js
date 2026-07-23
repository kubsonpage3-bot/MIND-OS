// MIND OS Companion — popup.js
// All DOM manipulation lives here. Background worker handles all API calls.

async function getApiBase() {
  const { apiBaseUrl } = await browser.storage.local.get('apiBaseUrl');
  return apiBaseUrl || 'https://mind-os-d5sk.onrender.com';
}

// ─── DOM refs ────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const pairScreen   = $('pairScreen');
const mainUI       = $('mainUI');
const pairCodeInput = $('pairCodeInput');
const pairBtn      = $('pairBtn');
const pairError    = $('pairError');

const goldValue    = $('goldValue');
const hpValue      = $('hpValue');
const rankBadge    = $('rankBadge');
const xpBarFill    = $('xpBarFill');
const xpLevel      = $('xpLevel');
const xpBarProgress = $('xpBarProgress');
const streakBadge  = $('streakBadge');
const manaBarFill  = $('manaBarFill');
const manaValue    = $('manaValue');

const tabs         = document.querySelectorAll('.tab');
const tabContents  = document.querySelectorAll('.tab-content');

// Timer
const timerDisplay  = $('timerDisplay');
const timerLabel    = $('timerLabel');
const timerStartBtn = $('timerStartBtn');
const timerResetBtn = $('timerResetBtn');
const ringProgress  = $('ringProgress');
const todayPomos    = $('todayPomos');
const totalHours    = $('totalHours');
const totalPomos    = $('totalPomos');

// Blocklist
const currentTabDomain = $('currentTabDomain');
const blockCurrentBtn  = $('blockCurrentBtn');
const blocklistUl      = $('blocklist-ul');
const blocklistEmpty   = $('blocklistEmpty');
const manualDomainInput = $('manualDomainInput');
const addManualBtn     = $('addManualBtn');

// Settings
const defaultCostInput     = $('defaultCostInput');
const defaultDurationInput = $('defaultDurationInput');
const saveDefaultsBtn      = $('saveDefaultsBtn');
const defaultsSaved        = $('defaultsSaved');
const disconnectBtn        = $('disconnectBtn');
const syncNowBtn           = $('syncNowBtn');
const lastSyncEl           = $('lastSync');

// Modals
const editModal       = $('editModal');
const editDomainEl    = $('editDomain');
const editCostInput   = $('editCostInput');
const editDurationInput = $('editDurationInput');
const editSaveBtn     = $('editSaveBtn');
const editCancelBtn   = $('editCancelBtn');

const unlockModal       = $('unlockModal');
const unlockModalDomain = $('unlockModalDomain');
const unlockModalCost   = $('unlockModalCost');
const unlockModalDuration = $('unlockModalDuration');
const unlockModalGold   = $('unlockModalGold');
const unlockConfirmBtn  = $('unlockConfirmBtn');
const unlockCancelBtn   = $('unlockCancelBtn');
const unlockError       = $('unlockError');

// ─── State ───────────────────────────────────────────────────────────────────

let state = {
  gold: 0, hp: 0, maxHp: 100,
  xp: 0, xpToNextLevel: 150, level: 1,
  rank: 'E', rankProgressPct: 0,
  mana: 0, maxMana: 100,
  streak: 0,
  blockedSites: [],
  activeUnlocks: [],
  todayTasks: [],
};

let editingSiteId    = null;
let unlockingSite    = null;  // { id, domain, unlock_cost, unlock_duration_minutes }
let timerInterval    = null;
let timerRunning     = false;
let timerSeconds     = 25 * 60;
let timerTotalSeconds = 25 * 60;
let pomodoroSessionId = null;  // track active session

// ─── Init ────────────────────────────────────────────────────────────────────

async function init() {
  const { extensionToken } = await browser.storage.local.get('extensionToken');
  if (!extensionToken) {
    showPairScreen();
    return;
  }
  showMainUI();
  await syncAndRender();
  setupCurrentTabDomain();
  loadStoredDefaults();
}

// ─── Pair / Unpair ────────────────────────────────────────────────────────────

function showPairScreen() {
  pairScreen.classList.remove('hidden');
  mainUI.classList.add('hidden');
}

function showMainUI() {
  pairScreen.classList.add('hidden');
  mainUI.classList.remove('hidden');
}

pairBtn.addEventListener('click', async () => {
  const code = pairCodeInput.value.trim().toUpperCase();
  if (!code) return;
  pairBtn.disabled = true;
  pairBtn.textContent = 'Connecting…';
  pairError.classList.add('hidden');

  const res = await browser.runtime.sendMessage({ type: 'PAIR', code });
  if (res.ok) {
    showMainUI();
    await syncAndRender();
    setupCurrentTabDomain();
  } else {
    const msgs = {
      invalid_code: 'Invalid code. Check and try again.',
      code_expired_or_used: 'Code expired. Generate a new one in MIND OS Settings.',
    };
    pairError.textContent = msgs[res.error] || 'Connection failed. Try again.';
    pairError.classList.remove('hidden');
  }
  pairBtn.disabled = false;
  pairBtn.textContent = 'Connect';
});

pairCodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') pairBtn.click();
});

disconnectBtn.addEventListener('click', async () => {
  if (!confirm('Disconnect extension from MIND OS? Site blocking will stop.')) return;
  await browser.runtime.sendMessage({ type: 'UNPAIR' });
  showPairScreen();
});

// ─── Sync ────────────────────────────────────────────────────────────────────

const DEFAULT_BASE_ACTIVITIES = [
  { key: 'mathematics', label: 'Mathematics', icon: '∑' },
  { key: 'physics', label: 'Physics', icon: '⚛' },
  { key: 'history', label: 'History', icon: '📜' },
  { key: 'english', label: 'English', icon: '✍' },
  { key: 'philosophy', label: 'Philosophy', icon: 'φ' },
  { key: 'vocabulary', label: 'Vocabulary', icon: 'Aa' },
  { key: 'chess', label: 'Chess / Logic', icon: '♟' },
  { key: 'coding', label: 'Coding', icon: '</>' },
  { key: 'creative_answers', label: 'Creative Answers', icon: '💡' },
  { key: 'exercise', label: 'Exercise', icon: '⚡' },
  { key: 'prayer', label: 'Prayer / Meditation', icon: '🕊️' },
  { key: 'running', label: 'Running', icon: '🏃' },
  { key: 'reading', label: 'Reading', icon: '📖' },
  { key: 'german', label: 'German', icon: '🇩🇪' },
  { key: 'languages', label: 'Other Languages', icon: '🌐' },
  { key: 'psychology', label: 'Psychology', icon: '💗' },
  { key: 'chemistry', label: 'Chemistry', icon: '💎' },
  { key: 'neuroscience', label: 'Neuroscience', icon: '🧠' },
];

function renderActivityOptions(activities) {
  if (!extActivitySelect) return;
  const list = (Array.isArray(activities) && activities.length > 0) ? activities : DEFAULT_BASE_ACTIVITIES;
  const currentVal = extActivitySelect.value;
  extActivitySelect.innerHTML = '<option value="">-- Select Activity --</option>';
  list.forEach((act) => {
    const opt = document.createElement('option');
    opt.value = act.key;
    opt.textContent = `${act.icon || '🔘'} ${act.label || act.key}`;
    extActivitySelect.appendChild(opt);
  });
  if (currentVal) {
    extActivitySelect.value = currentVal;
  }
}

async function syncAndRender() {
  const res = await browser.runtime.sendMessage({ type: 'SYNC' });
  if (!res?.ok) { showPairScreen(); return; }

  state.gold           = res.gold ?? 0;
  state.hp             = res.hp ?? 0;
  state.maxHp          = res.maxHp ?? 100;
  state.xp             = res.xp ?? 0;
  state.xpToNextLevel  = res.xp_to_next_level ?? 150;
  state.level          = res.level ?? 1;
  state.rank           = res.rank ?? 'E';
  state.rankProgressPct = res.rank_progress_pct ?? 0;
  state.mana           = res.mana ?? 0;
  state.maxMana        = res.max_mana ?? 100;
  state.streak         = res.streak ?? 0;
  state.blockedSites   = res.blockedSites ?? [];
  state.activeUnlocks  = res.activeUnlocks ?? [];
  state.todayTasks     = res.today_tasks ?? [];

  if (res.user_activities) {
    renderActivityOptions(res.user_activities);
  }

  if (res.active_session?.active) {
    const act = res.active_session;
    if (act.linked_activity_key) {
      isLinkedMode = true;
      selectedExtActivity = act.linked_activity_key;
      linkedExtDuration = act.duration_minutes;
      if (extModeLinkedBtn) extModeLinkedBtn.click();
      if (extActivitySelect) extActivitySelect.value = act.linked_activity_key;
    }
    updateCharBadge(act.mode || 'work');
    timerTotalSeconds = act.duration_minutes * 60;
    timerSeconds = act.remaining_seconds;
    if (!act.is_paused && act.remaining_seconds > 0 && !timerRunning) {
      startTimer();
    } else if (act.is_paused && timerRunning) {
      pauseTimer();
    }
    updateTimerDisplay();
  }

  renderStats();
  renderBlocklist();
  renderTodayTasks();
  loadPomodoroStats();
  lastSyncEl.textContent = 'Last sync: ' + new Date().toLocaleTimeString();
}

syncNowBtn.addEventListener('click', () => syncAndRender());

// ─── Stats bar ───────────────────────────────────────────────────────────────

function renderStats() {
  goldValue.textContent = state.gold.toLocaleString();
  hpValue.textContent   = `${state.hp}/${state.maxHp}`;

  // Rank badge
  if (rankBadge) {
    rankBadge.textContent = state.rank;
    rankBadge.setAttribute('data-rank', state.rank);
  }

  // XP Bar
  if (xpBarFill) xpBarFill.style.width = `${state.rankProgressPct}%`;
  if (xpLevel) xpLevel.textContent = state.level;
  if (xpBarProgress) xpBarProgress.textContent = `${state.xp}/${state.xpToNextLevel} XP`;
  if (streakBadge) streakBadge.textContent = `🔥 ${state.streak}`;

  // Mana
  if (manaValue) manaValue.textContent = `${state.mana}/${state.maxMana}`;
  const manaPct = state.maxMana > 0 ? Math.round((state.mana / state.maxMana) * 100) : 0;
  if (manaBarFill) manaBarFill.style.width = `${manaPct}%`;
}

// ─── Tab nav ─────────────────────────────────────────────────────────────────

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => t.classList.remove('active'));
    tabContents.forEach((c) => c.classList.add('hidden'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.remove('hidden');
  });
});

// ─── TODAY TAB ────────────────────────────────────────────────────────────────

function renderTodayTasks() {
  const list = $('todayTaskList');
  const empty = $('todayEmpty');
  const dateEl = $('todayDate');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  if (!list) return;

  const tasks = state.todayTasks || [];
  if (!tasks.length) {
    if (empty) empty.classList.remove('hidden');
    list.querySelectorAll('.task-card').forEach(el => el.remove());
    return;
  }
  if (empty) empty.classList.add('hidden');
  list.querySelectorAll('.task-card').forEach(el => el.remove());

  tasks.forEach((task) => {
    const card = document.createElement('div');
    card.className = `task-card${task.completed_today ? ' completed' : ''}`;
    card.dataset.id = task.id;
    const actionHtml = task.completed_today
      ? `<span class="task-done-badge">✓ DONE</span>`
      : `<button class="task-complete-btn" data-id="${task.id}">✓ Complete</button>`;
    card.innerHTML = `
      <span class="task-card-icon">${task.icon || '🔘'}</span>
      <span class="task-card-title">${task.title}</span>
      ${actionHtml}
    `;
    list.appendChild(card);
  });

  list.querySelectorAll('.task-complete-btn').forEach((btn) => {
    btn.addEventListener('click', () => completeTaskFromExtension(parseInt(btn.dataset.id)));
  });
}

async function completeTaskFromExtension(taskId) {
  const btn = $('todayTaskList').querySelector(`.task-complete-btn[data-id="${taskId}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/extension/complete-task/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      // Mark as done locally for instant feedback
      state.todayTasks = state.todayTasks.map(t =>
        t.id === taskId ? { ...t, completed_today: true } : t
      );
      renderTodayTasks();
      showRewardToast(`+${data.xp_gained} XP  •  +${data.gold_gained} 🪙`);
      // Re-sync to get updated gold/xp in header
      setTimeout(syncAndRender, 800);
    } else {
      const errMap = {
        already_completed_today: 'Already done today!',
        task_not_found: 'Task not found.',
      };
      if (btn) { btn.disabled = false; btn.textContent = '✓ Complete'; }
      alert(errMap[data.error] || 'Could not complete task.');
    }
  } catch (e) {
    console.error('[MIND OS] completeTaskFromExtension error:', e);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Complete'; }
  }
}

let _rewardToastTimeout = null;
function showRewardToast(text) {
  const toast = $('rewardToast');
  const toastText = $('rewardToastText');
  if (!toast || !toastText) return;
  if (_rewardToastTimeout) clearTimeout(_rewardToastTimeout);
  toastText.textContent = text;
  toast.classList.remove('hidden');
  _rewardToastTimeout = setTimeout(() => toast.classList.add('hidden'), 2100);
}

// ─── TIMER TAB ───────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 44; // 276.46
let isLinkedMode = false;
let selectedExtActivity = null;
let linkedExtDuration = 30;
let selectedStarRating = 3;

const extModeStandaloneBtn = $('extModeStandaloneBtn');
const extModeLinkedBtn     = $('extModeLinkedBtn');
const extActivityBox       = $('extActivityBox');
const extActivitySelect    = $('extActivitySelect');
const extDur30Btn          = $('extDur30Btn');
const extDur60Btn          = $('extDur60Btn');
const extCharBadge         = $('extCharBadge');
const extCharIcon          = $('extCharIcon');
const extCharName          = $('extCharName');
const extCharMode          = $('extCharMode');
const extRatingOverlay     = $('extRatingOverlay');
const extConfirmRatingBtn  = $('extConfirmRatingBtn');

if (extModeStandaloneBtn) {
  extModeStandaloneBtn.addEventListener('click', () => {
    isLinkedMode = false;
    extModeStandaloneBtn.classList.add('active');
    extModeLinkedBtn.classList.remove('active');
    extActivityBox.classList.add('hidden');
    timerTotalSeconds = 25 * 60;
    timerSeconds = 25 * 60;
    updateTimerDisplay();
  });
}

if (extModeLinkedBtn) {
  extModeLinkedBtn.addEventListener('click', () => {
    isLinkedMode = true;
    extModeLinkedBtn.classList.add('active');
    extModeStandaloneBtn.classList.remove('active');
    extActivityBox.classList.remove('hidden');
    timerTotalSeconds = linkedExtDuration * 60;
    timerSeconds = linkedExtDuration * 60;
    updateTimerDisplay();
  });
}

if (extActivitySelect) {
  extActivitySelect.addEventListener('change', (e) => {
    selectedExtActivity = e.target.value || null;
  });
}

const extCustomMinInput = $('extCustomMinInput');

document.querySelectorAll('.dur-preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (timerRunning) return;
    document.querySelectorAll('.dur-preset-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const mins = parseInt(btn.getAttribute('data-min') || '25', 10);
    linkedExtDuration = mins;
    timerTotalSeconds = mins * 60;
    timerSeconds = mins * 60;
    if (extCustomMinInput) extCustomMinInput.value = '';
    updateTimerDisplay();
  });
});

if (extCustomMinInput) {
  extCustomMinInput.addEventListener('input', (e) => {
    if (timerRunning) return;
    const mins = parseInt(e.target.value, 10);
    if (!isNaN(mins) && mins > 0 && mins <= 480) {
      document.querySelectorAll('.dur-preset-btn').forEach((b) => b.classList.remove('active'));
      linkedExtDuration = mins;
      timerTotalSeconds = mins * 60;
      timerSeconds = mins * 60;
      updateTimerDisplay();
    }
  });
}

// 1-5 Star Rating selection
document.querySelectorAll('.star-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    selectedStarRating = parseInt(btn.getAttribute('data-rating') || '3', 10);
    document.querySelectorAll('.star-btn').forEach((b) => {
      const r = parseInt(b.getAttribute('data-rating') || '0', 10);
      if (r <= selectedStarRating) {
        b.classList.add('selected');
      } else {
        b.classList.remove('selected');
      }
    });
  });
});

if (extConfirmRatingBtn) {
  extConfirmRatingBtn.addEventListener('click', async () => {
    extRatingOverlay.classList.add('hidden');
    await finishSessionWithRating(selectedStarRating);
  });
}

function updateCharBadge(modeStr) {
  if (!extCharBadge) return;
  extCharBadge.className = `char-badge char-${modeStr}`;
  if (modeStr === 'break') {
    extCharIcon.textContent = '⚡';
    extCharName.textContent = 'LIGHTNING';
    extCharMode.textContent = '· SHORT BREAK';
  } else if (modeStr === 'longBreak') {
    extCharIcon.textContent = '🔥';
    extCharName.textContent = 'SUMMONER';
    extCharMode.textContent = '· LONG REST';
  } else {
    extCharIcon.textContent = '💖';
    extCharName.textContent = 'BEATRIX';
    extCharMode.textContent = '· FOCUS MODE';
  }
}

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;

  const progress = timerTotalSeconds > 0 ? timerSeconds / timerTotalSeconds : 1;
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

function startTimer() {
  if (timerRunning) return;
  if (isLinkedMode && !selectedExtActivity) {
    alert('Please select a Linked Activity first!');
    return;
  }
  timerRunning = true;
  timerStartBtn.textContent = '⏸ Pause';
  if (ringProgress) ringProgress.classList.add('running');

  openPomodoroSession();

  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerStartBtn.textContent = '▶ Start';
      if (ringProgress) ringProgress.classList.remove('running');
      
      if (isLinkedMode) {
        extRatingOverlay.classList.remove('hidden');
      } else {
        completePomodoroSession();
      }
      sendNotification('🍅 Pomodoro complete!', 'Time for a break. Gold reward incoming!');
      timerSeconds = timerTotalSeconds;
      updateTimerDisplay();
      return;
    }
    timerSeconds--;
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  if (ringProgress) ringProgress.classList.remove('running');
  timerStartBtn.textContent = '▶ Resume';
  notifyPauseSession();
}

timerStartBtn.addEventListener('click', () => {
  if (timerRunning) { pauseTimer(); } else { startTimer(); }
});

timerResetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerTotalSeconds;
  timerStartBtn.textContent = '▶ Start';
  if (ringProgress) ringProgress.classList.remove('running');
  notifyResetSession();
  updateTimerDisplay();
});

async function finishSessionWithRating(ratingVal) {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/api/pomodoro/sessions/active-session/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
      body: JSON.stringify({ rating: ratingVal }),
    });
    syncAndRender();
  } catch (e) {
    console.error('[MIND OS] finishSessionWithRating error:', e);
  }
}

// Start active pomodoro session on backend
async function openPomodoroSession() {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/api/pomodoro/sessions/active-session/start/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
      body: JSON.stringify({
        linked_activity_key: isLinkedMode ? selectedExtActivity : null,
        duration_minutes: Math.round(timerTotalSeconds / 60),
        mode: 'work',
      }),
    });
  } catch (e) {
    console.error('[MIND OS] openPomodoroSession error:', e);
  }
}

async function notifyPauseSession() {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/api/pomodoro/sessions/active-session/pause/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
    });
  } catch (e) {
    console.error('[MIND OS] notifyPauseSession error:', e);
  }
}

async function notifyResetSession() {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/api/pomodoro/sessions/active-session/reset/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
    });
  } catch (e) {
    console.error('[MIND OS] notifyResetSession error:', e);
  }
}

// Mark session complete → triggers gold/XP reward on backend
async function completePomodoroSession() {
  if (!pomodoroSessionId) return;
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    await fetch(`${apiBase}/api/pomodoro/sessions/${pomodoroSessionId}/complete/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
    });
    pomodoroSessionId = null;
    // Sync to pick up new gold/XP
    setTimeout(syncAndRender, 1000);
  } catch (e) {
    console.error('[MIND OS] completePomodoroSession error:', e);
  }
}

async function loadPomodoroStats() {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/pomodoro/sessions/stats/`, {
      headers: { Authorization: `Bearer ${extensionToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    todayPomos.textContent  = data.today_pomodoros ?? '—';
    totalHours.textContent  = data.total_hours ? Number(data.total_hours).toFixed(1) : '—';
    totalPomos.textContent  = data.total_pomodoros ?? '—';
  } catch (e) {
    console.error('[MIND OS] loadPomodoroStats error:', e);
  }
}

function sendNotification(title, message) {
  browser.notifications.create({
    type: 'basic',
    iconUrl: '../icons/icon-96.png',
    title,
    message,
  });
}

// ─── BLOCKLIST TAB ────────────────────────────────────────────────────────────

async function setupCurrentTabDomain() {
  const res = await browser.runtime.sendMessage({ type: 'GET_CURRENT_TAB_DOMAIN' });
  currentTabDomain.textContent = res.domain || 'unknown';
}

blockCurrentBtn.addEventListener('click', async () => {
  const domain = currentTabDomain.textContent;
  if (!domain || domain === 'unknown' || domain === 'loading...') return;
  await addSite(domain);
});

addManualBtn.addEventListener('click', async () => {
  const domain = manualDomainInput.value.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  if (!domain) return;
  await addSite(domain);
  manualDomainInput.value = '';
});

manualDomainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addManualBtn.click();
});

async function addSite(domain) {
  const cost     = parseInt(defaultCostInput.value) || 111;
  const duration = parseInt(defaultDurationInput.value) || 30;
  blockCurrentBtn.disabled = true;
  addManualBtn.disabled = true;

  const res = await browser.runtime.sendMessage({
    type: 'ADD_SITE', domain, unlock_cost: cost, unlock_duration_minutes: duration,
  });
  blockCurrentBtn.disabled = false;
  addManualBtn.disabled = false;

  if (res.ok) {
    await syncAndRender();
  } else {
    alert('Failed to add site. Make sure extension is connected.');
  }
}

function renderBlocklist() {
  if (!state.blockedSites.length) {
    blocklistEmpty.classList.remove('hidden');
    blocklistUl.innerHTML = '';
    return;
  }
  blocklistEmpty.classList.add('hidden');

  const now = new Date();
  const activeUnlockMap = new Map(
    state.activeUnlocks
      .filter((u) => new Date(u.unlocked_until) > now)
      .map((u) => [u.domain, u])
  );

  blocklistUl.innerHTML = '';
  state.blockedSites.forEach((site) => {
    const unlock = activeUnlockMap.get(site.domain);
    const li = document.createElement('li');
    li.className = `site-item${unlock ? ' unlocked' : ''}`;

    const timeLeft = unlock
      ? Math.max(0, Math.round((new Date(unlock.unlocked_until) - now) / 60000))
      : null;

    li.innerHTML = `
      <span class="site-domain">${site.domain}</span>
      <span class="site-meta">🪙${site.unlock_cost} · ${site.unlock_duration_minutes}min</span>
      ${unlock ? `<span class="site-unlock-badge">🔓 ${timeLeft}m left</span>` : ''}
      <div class="site-actions">
        ${!unlock ? `<button class="btn-icon unlock-btn" data-id="${site.id}" data-domain="${site.domain}" data-cost="${site.unlock_cost}" data-duration="${site.unlock_duration_minutes}" title="Pay gold to unlock">🔓</button>` : ''}
        <button class="btn-icon edit-btn" data-id="${site.id}" data-domain="${site.domain}" data-cost="${site.unlock_cost}" data-duration="${site.unlock_duration_minutes}" title="Edit rule">✏️</button>
        <button class="btn-icon remove-btn" data-id="${site.id}" title="Remove">🗑</button>
      </div>
    `;
    blocklistUl.appendChild(li);
  });

  // Event delegation
  blocklistUl.querySelectorAll('.unlock-btn').forEach((btn) => {
    btn.addEventListener('click', () => openUnlockModal({
      id: btn.dataset.id,
      domain: btn.dataset.domain,
      unlock_cost: parseInt(btn.dataset.cost),
      unlock_duration_minutes: parseInt(btn.dataset.duration),
    }));
  });

  blocklistUl.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal({
      id: btn.dataset.id,
      domain: btn.dataset.domain,
      unlock_cost: parseInt(btn.dataset.cost),
      unlock_duration_minutes: parseInt(btn.dataset.duration),
    }));
  });

  blocklistUl.querySelectorAll('.remove-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this site from blocklist?')) return;
      await browser.runtime.sendMessage({ type: 'REMOVE_SITE', id: btn.dataset.id });
      await syncAndRender();
    });
  });
}

// ─── UNLOCK MODAL ─────────────────────────────────────────────────────────────

function openUnlockModal(site) {
  unlockingSite = site;
  unlockModalDomain.textContent   = site.domain;
  unlockModalCost.textContent     = site.unlock_cost;
  unlockModalDuration.textContent = site.unlock_duration_minutes;
  unlockModalGold.textContent     = state.gold.toLocaleString();
  unlockError.classList.add('hidden');
  unlockModal.classList.remove('hidden');
}

unlockCancelBtn.addEventListener('click', () => {
  unlockModal.classList.add('hidden');
  unlockingSite = null;
});

unlockConfirmBtn.addEventListener('click', async () => {
  if (!unlockingSite) return;
  unlockConfirmBtn.disabled = true;
  unlockConfirmBtn.textContent = 'Processing…';

  const res = await browser.runtime.sendMessage({
    type: 'UNLOCK_SITE', domain: unlockingSite.domain,
  });

  unlockConfirmBtn.disabled = false;
  unlockConfirmBtn.textContent = 'Pay & Unlock';

  if (res.ok) {
    state.gold = res.gold;
    renderStats();
    unlockModal.classList.add('hidden');
    unlockingSite = null;
    await syncAndRender();
  } else {
    const errMsgs = {
      insufficient_gold: `Not enough gold! You have ${res.gold ?? 0} 🪙`,
      site_not_in_blocklist: 'Site not found in blocklist.',
    };
    unlockError.textContent = errMsgs[res.error] || 'Unlock failed. Try again.';
    unlockError.classList.remove('hidden');
  }
});

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────

function openEditModal(site) {
  editingSiteId = site.id;
  editDomainEl.textContent     = site.domain;
  editCostInput.value          = site.unlock_cost;
  editDurationInput.value      = site.unlock_duration_minutes;
  editModal.classList.remove('hidden');
}

editCancelBtn.addEventListener('click', () => {
  editModal.classList.add('hidden');
  editingSiteId = null;
});

editSaveBtn.addEventListener('click', async () => {
  if (!editingSiteId) return;
  const cost     = parseInt(editCostInput.value) || 111;
  const duration = parseInt(editDurationInput.value) || 30;

  editSaveBtn.disabled = true;
  editSaveBtn.textContent = 'Saving…';

  const res = await browser.runtime.sendMessage({
    type: 'UPDATE_SITE',
    id: editingSiteId,
    unlock_cost: cost,
    unlock_duration_minutes: duration,
  });

  editSaveBtn.disabled = false;
  editSaveBtn.textContent = 'Save';
  editModal.classList.add('hidden');
  editingSiteId = null;

  if (res.ok) await syncAndRender();
});

// ─── SETTINGS TAB ────────────────────────────────────────────────────────────

const serverUrlSelect = $('serverUrlSelect');

async function loadStoredDefaults() {
  const cost = localStorage.getItem('mindos_default_cost');
  const dur  = localStorage.getItem('mindos_default_duration');
  if (cost) defaultCostInput.value = cost;
  if (dur)  defaultDurationInput.value = dur;

  if (serverUrlSelect) {
    const { apiBaseUrl } = await browser.storage.local.get('apiBaseUrl');
    serverUrlSelect.value = apiBaseUrl || 'https://mind-os-d5sk.onrender.com';
  }
}

if (serverUrlSelect) {
  serverUrlSelect.addEventListener('change', async () => {
    await browser.storage.local.set({ apiBaseUrl: serverUrlSelect.value });
    syncAndRender();
  });
}

saveDefaultsBtn.addEventListener('click', () => {
  localStorage.setItem('mindos_default_cost', defaultCostInput.value);
  localStorage.setItem('mindos_default_duration', defaultDurationInput.value);
  defaultsSaved.classList.remove('hidden');
  setTimeout(() => defaultsSaved.classList.add('hidden'), 2000);
});

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function loadHistoryStats() {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;

    const apiBase = await getApiBase();
    const res = await fetch(`${apiBase}/api/pomodoro/sessions/stats/`, {
      headers: { Authorization: `Bearer ${extensionToken}` },
    });
    if (!res.ok) return;
    const data = await res.json();

    // 4 stat cards
    $('histTodayPomos').textContent  = data.today_pomodoros ?? '0';
    $('histTotalHours').textContent  = data.total_hours ? Number(data.total_hours).toFixed(1) : '0';
    $('histTotalPomos').textContent  = data.total_pomodoros ?? '0';
    $('histBestStreak').textContent  = (data.best_streak ?? '0') + 'd';

    // Weekly bar chart from heatmap_data (last 7 days)
    renderWeeklyBars(data.heatmap_data || {});
  } catch (e) {
    console.error('[MIND OS] loadHistoryStats error:', e);
  }
}

function renderWeeklyBars(heatmapData) {
  const weeklyBarsEl = $('weeklyBars');
  if (!weeklyBarsEl) return;
  weeklyBarsEl.innerHTML = '';

  // Build last 7 days array (oldest → newest)
  const days = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    days.push({ key, label: DAY_LABELS[d.getDay()], isToday: i === 0 });
  }

  // Find max for scaling
  const counts = days.map((d) => heatmapData[d.key] || 0);
  const max = Math.max(...counts, 1);

  days.forEach(({ key, label, isToday }, idx) => {
    const count = counts[idx];
    const heightPct = Math.max(8, (count / max) * 100); // min 8% so bar is visible

    const col = document.createElement('div');
    col.className = 'weekly-bar-col';
    col.innerHTML = `
      <div class="weekly-bar ${count > 0 ? 'has-data' : ''} ${isToday ? 'today' : ''}"
           style="height: ${heightPct}%"
           title="${label}: ${count} session${count !== 1 ? 's' : ''}">
      </div>
      <span class="weekly-bar-label">${label.slice(0, 1)}</span>
    `;
    weeklyBarsEl.appendChild(col);
  });
}

// Load history when its tab is clicked
document.querySelector('[data-tab="history"]')?.addEventListener('click', loadHistoryStats);

const histRefreshBtn = $('histRefreshBtn');
if (histRefreshBtn) histRefreshBtn.addEventListener('click', loadHistoryStats);

// ─── Bootstrap ───────────────────────────────────────────────────────────────

updateTimerDisplay(); // show 25:00 immediately
init();
