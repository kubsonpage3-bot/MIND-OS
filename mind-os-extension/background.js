// MIND OS Companion — background.js (service worker)
// Handles: token auth, blocklist sync, declarativeNetRequest rules, alarm-based re-blocking

async function getApiBase() {
  const { apiBaseUrl } = await browser.storage.local.get('apiBaseUrl');
  return apiBaseUrl || 'https://mind-os-d5sk.onrender.com';
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getToken() {
  const { extensionToken } = await browser.storage.local.get('extensionToken');
  return extensionToken || null;
}

async function apiFetch(path, opts = {}) {
  const token = await getToken();
  const apiBase = await getApiBase();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...opts.headers,
  };
  const res = await fetch(`${apiBase}${path}`, { ...opts, headers });
  return res;
}

// ─── Block / Unblock via declarativeNetRequest ───────────────────────────────

function domainToRuleId(domain) {
  // Stable integer from domain string — used as declarativeNetRequest rule id
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = ((hash << 5) - hash + domain.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 100000 + 1; // 1–100000, avoid 0
}

async function applyBlockRules(blockedSites) {
  // Remove all existing dynamic rules first, then re-add from server list
  const existing = await browser.declarativeNetRequest.getDynamicRules();
  const removeIds = existing.map((r) => r.id);

  // Re-add only sites that are NOT currently unlocked
  const { activeUnlocks = [] } = await browser.storage.local.get('activeUnlocks');
  const unlockedDomains = new Set(
    activeUnlocks
      .filter((u) => new Date(u.unlocked_until) > new Date())
      .map((u) => u.domain)
  );

  const addRules = blockedSites
    .filter((s) => !unlockedDomains.has(s.domain))
    .map((s) => ({
      id: domainToRuleId(s.domain),
      priority: 1,
      action: { type: 'redirect', redirect: { extensionPath: '/popup/blocked.html' } },
      condition: {
        urlFilter: `||${s.domain}^`,
        resourceTypes: ['main_frame'],
      },
    }));

  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
  console.log('[MIND OS] Block rules applied:', addRules.length, 'sites blocked.');
}

async function temporarilyUnblock(domain, unlockedUntil) {
  const ruleId = domainToRuleId(domain);
  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });

  // Schedule re-block alarm
  const delayMs = new Date(unlockedUntil).getTime() - Date.now();
  const delayMinutes = Math.max(0.1, delayMs / 60000);
  await browser.alarms.create(`reblock-${domain}`, { delayInMinutes: delayMinutes });
  console.log(`[MIND OS] ${domain} unlocked for ${delayMinutes.toFixed(1)} min`);
}

// ─── Sync blocklist from server ──────────────────────────────────────────────

async function syncBlocklist() {
  const token = await getToken();
  if (!token) return;

  try {
    const res = await apiFetch('/api/extension/status/');
    if (!res.ok) {
      if (res.status === 401) {
        // Token revoked — clear local state
        await browser.storage.local.remove('extensionToken');
      }
      return;
    }
    const data = await res.json();
    await browser.storage.local.set({
      blockedSites: data.blocked_sites,
      activeUnlocks: data.active_unlocks,
      gold: data.gold,
      hp: data.hp,
      maxHp: data.max_hp,
      mana: data.mana,
      max_mana: data.max_mana,
      xp: data.xp,
      xp_to_next_level: data.xp_to_next_level,
      level: data.level,
      rank: data.rank,
      rank_progress_pct: data.rank_progress_pct,
      streak: data.streak,
      active_session: data.active_session,
      user_activities: data.user_activities,
      today_tasks: data.today_tasks,
    });
    await applyBlockRules(data.blocked_sites);
  } catch (e) {
    console.error('[MIND OS] syncBlocklist error:', e);
  }
}

// ─── Alarm handler (re-block after unlock expires) ───────────────────────────

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('reblock-')) {
    const domain = alarm.name.replace('reblock-', '');
    console.log(`[MIND OS] Re-blocking ${domain}`);
    // Remove unlock from local cache
    const { activeUnlocks = [] } = await browser.storage.local.get('activeUnlocks');
    const updated = activeUnlocks.filter((u) => u.domain !== domain);
    await browser.storage.local.set({ activeUnlocks: updated });
    // Sync to get fresh list and re-apply rules
    await syncBlocklist();
  }

  if (alarm.name === 'periodic-sync') {
    await syncBlocklist();
  }
});

// ─── Message handler (from popup) ────────────────────────────────────────────

browser.runtime.onMessage.addListener(async (msg) => {
  switch (msg.type) {
    case 'SYNC': {
      await syncBlocklist();
      const state = await browser.storage.local.get([
        'gold', 'hp', 'maxHp',
        'mana', 'max_mana', 'xp', 'xp_to_next_level', 'level',
        'rank', 'rank_progress_pct', 'streak',
        'blockedSites', 'activeUnlocks', 'active_session',
        'user_activities', 'today_tasks',
      ]);
      return { ok: true, ...state };
    }

    case 'PAIR': {
      // Exchange OTP code for token
      const apiBase = await getApiBase();
      const res = await fetch(`${apiBase}/api/extension/pair/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: msg.code }),
      });
      if (!res.ok) {
        const err = await res.json();
        return { ok: false, error: err.error };
      }
      const { token } = await res.json();
      await browser.storage.local.set({ extensionToken: token });
      await syncBlocklist();
      return { ok: true };
    }

    case 'UNPAIR': {
      await browser.storage.local.remove('extensionToken');
      // Remove all block rules (extension unlinked = no blocking)
      const rules = await browser.declarativeNetRequest.getDynamicRules();
      await browser.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map((r) => r.id),
      });
      return { ok: true };
    }

    case 'ADD_SITE': {
      const res = await apiFetch('/api/extension/blocklist/', {
        method: 'POST',
        body: JSON.stringify({
          domain: msg.domain,
          unlock_cost: msg.unlock_cost,
          unlock_duration_minutes: msg.unlock_duration_minutes,
        }),
      });
      if (!res.ok) return { ok: false, error: await res.text() };
      await syncBlocklist();
      return { ok: true };
    }

    case 'REMOVE_SITE': {
      const res = await apiFetch(`/api/extension/blocklist/${msg.id}/`, { method: 'DELETE' });
      if (!res.ok) return { ok: false };
      await syncBlocklist();
      return { ok: true };
    }

    case 'UPDATE_SITE': {
      const res = await apiFetch(`/api/extension/blocklist/${msg.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          unlock_cost: msg.unlock_cost,
          unlock_duration_minutes: msg.unlock_duration_minutes,
        }),
      });
      if (!res.ok) return { ok: false };
      await syncBlocklist();
      return { ok: true };
    }

    case 'UNLOCK_SITE': {
      const res = await apiFetch('/api/extension/unlock-site/', {
        method: 'POST',
        body: JSON.stringify({ domain: msg.domain }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error, gold: data.gold };
      // Update gold locally and remove block rule immediately
      await browser.storage.local.set({ gold: data.gold });
      await temporarilyUnblock(msg.domain, data.unlocked_until);
      return { ok: true, gold: data.gold, unlocked_until: data.unlocked_until };
    }

    case 'GET_CURRENT_TAB_DOMAIN': {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.url) return { domain: null };
      try {
        const url = new URL(tab.url);
        return { domain: url.hostname.replace(/^www\./, '') };
      } catch {
        return { domain: null };
      }
    }

    default:
      return { ok: false, error: 'unknown_message_type' };
  }
});

// ─── Init ────────────────────────────────────────────────────────────────────

browser.runtime.onInstalled.addListener(async () => {
  // Periodic sync every 5 minutes
  await browser.alarms.create('periodic-sync', { periodInMinutes: 5 });
  await syncBlocklist();
  console.log('[MIND OS] Extension installed / updated.');
});

browser.runtime.onStartup.addListener(async () => {
  await syncBlocklist();
});
