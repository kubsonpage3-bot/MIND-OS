// MIND OS Companion — popup.js
// All DOM manipulation lives here. Background worker handles all API calls.

const API_BASE = 'https://api.mindosgrowth.org';

// ─── DOM refs ────────────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const pairScreen   = $('pairScreen');
const mainUI       = $('mainUI');
const pairCodeInput = $('pairCodeInput');
const pairBtn      = $('pairBtn');
const pairError    = $('pairError');

const goldValue    = $('goldValue');
const hpValue      = $('hpValue');

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
  blockedSites: [],
  activeUnlocks: [],
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

async function syncAndRender() {
  const res = await browser.runtime.sendMessage({ type: 'SYNC' });
  if (!res?.ok) { showPairScreen(); return; }

  state.gold           = res.gold ?? 0;
  state.hp             = res.hp ?? 0;
  state.maxHp          = res.maxHp ?? 100;
  state.blockedSites   = res.blockedSites ?? [];
  state.activeUnlocks  = res.activeUnlocks ?? [];

  renderStats();
  renderBlocklist();
  loadPomodoroStats();
  lastSyncEl.textContent = 'Last sync: ' + new Date().toLocaleTimeString();
}

syncNowBtn.addEventListener('click', () => syncAndRender());

// ─── Stats bar ───────────────────────────────────────────────────────────────

function renderStats() {
  goldValue.textContent = state.gold.toLocaleString();
  hpValue.textContent   = `${state.hp}/${state.maxHp}`;
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

// ─── TIMER TAB ───────────────────────────────────────────────────────────────

const CIRCUMFERENCE = 2 * Math.PI * 44; // 276.46

function updateTimerDisplay() {
  const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const s = (timerSeconds % 60).toString().padStart(2, '0');
  timerDisplay.textContent = `${m}:${s}`;

  const progress = timerSeconds / timerTotalSeconds;
  ringProgress.style.strokeDashoffset = CIRCUMFERENCE * (1 - progress);
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerStartBtn.textContent = '⏸ Pause';

  // Open pomodoro session on backend
  openPomodoroSession();

  timerInterval = setInterval(() => {
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      timerStartBtn.textContent = '▶ Start';
      completePomodoroSession();
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
  timerStartBtn.textContent = '▶ Resume';
}

timerStartBtn.addEventListener('click', () => {
  if (timerRunning) { pauseTimer(); } else { startTimer(); }
});

timerResetBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  timerRunning = false;
  timerSeconds = timerTotalSeconds;
  timerStartBtn.textContent = '▶ Start';
  updateTimerDisplay();
});

// Start pomodoro session on backend
async function openPomodoroSession() {
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    const res = await fetch(`${API_BASE}/api/pomodoro/sessions/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${extensionToken}`,
      },
      body: JSON.stringify({
        duration_minutes: Math.round(timerTotalSeconds / 60),
        status: 'in_progress',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      pomodoroSessionId = data.id;
    }
  } catch (e) {
    console.error('[MIND OS] openPomodoroSession error:', e);
  }
}

// Mark session complete → triggers gold/XP reward on backend
async function completePomodoroSession() {
  if (!pomodoroSessionId) return;
  try {
    const { extensionToken } = await browser.storage.local.get('extensionToken');
    if (!extensionToken) return;
    await fetch(`${API_BASE}/api/pomodoro/sessions/${pomodoroSessionId}/complete/`, {
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
    const res = await fetch(`${API_BASE}/api/pomodoro/sessions/stats/`, {
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

function loadStoredDefaults() {
  const cost = localStorage.getItem('mindos_default_cost');
  const dur  = localStorage.getItem('mindos_default_duration');
  if (cost) defaultCostInput.value = cost;
  if (dur)  defaultDurationInput.value = dur;
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

    const res = await fetch(`${API_BASE}/api/pomodoro/sessions/stats/`, {
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
