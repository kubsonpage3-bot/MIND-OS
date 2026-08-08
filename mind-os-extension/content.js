// MIND OS Companion — content.js (In-Page Blocker Overlay)
// Injects pixel RPG overlay when user visits a blocked domain.
// Runs at document_start — hides page immediately to prevent flash, then checks if blocked.

(async function initMindOSBlocker() {
  // Step 1: Hide page immediately to prevent content flash while we check
  document.documentElement.style.visibility = 'hidden';

  const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();

  // Skip extension pages and empty domains
  if (
    !currentDomain ||
    window.location.protocol === 'moz-extension:' ||
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'about:'
  ) {
    document.documentElement.style.visibility = '';
    return;
  }

  let res;
  try {
    res = await browser.runtime.sendMessage({
      type: 'CHECK_BLOCKED',
      domain: currentDomain,
    });
  } catch (e) {
    // Extension context invalidated or not paired — restore page
    document.documentElement.style.visibility = '';
    return;
  }

  // Not blocked — restore page and exit
  if (!res?.isBlocked) {
    document.documentElement.style.visibility = '';
    return;
  }

  // Step 2: Keep page hidden and inject the overlay
  const { domain, unlockCost, unlockDuration, gold } = res;

  // Prevent duplicate overlay
  if (document.getElementById('mindos-overlay-host')) return;

  // Lock scroll
  document.documentElement.style.overflow = 'hidden';

  // Create host element
  const host = document.createElement('div');
  host.id = 'mindos-overlay-host';
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:auto;';
  (document.body || document.documentElement).appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const costDisplay = Math.round(Number(unlockCost));
  const durationDisplay = Math.round(Number(unlockDuration));
  const goldDisplay = Math.round(Number(gold));

  const characterImgUrl = browser.runtime.getURL('icons/pixel_wizard_guardian.png');
  const hasEnoughGold = goldDisplay >= costDisplay;

  // Inject styles into shadow DOM
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Nunito:wght@700;800;900&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      all: initial;
      display: block;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: auto;
      font-family: 'Press Start 2P', monospace;
    }

    .backdrop {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at 50% 35%, rgba(124, 58, 237, 0.18) 0%, rgba(6, 6, 14, 0.96) 70%);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 20px 40px;
      color: #f59e0b;
      animation: fadeIn 0.25s ease-out;
      overflow-y: auto;
    }

    /* Subtle background grid */
    .backdrop::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to   { opacity: 1; transform: scale(1); }
    }

    /* ─── Top Banner ─────────────────────────────── */
    .top-bar {
      width: 100%;
      max-width: 780px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: relative;
      z-index: 2;
    }

    .guardian-tag {
      font-size: 8px;
      color: #c084fc;
      background: rgba(124, 58, 237, 0.16);
      border: 1px solid rgba(124, 58, 237, 0.4);
      padding: 6px 12px;
      border-radius: 8px;
      letter-spacing: 0.08em;
      box-shadow: 0 0 12px rgba(124, 58, 237, 0.2);
    }

    .reload-btn {
      background: rgba(18, 18, 34, 0.8);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #f59e0b;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex-shrink: 0;
      backdrop-filter: blur(4px);
    }
    .reload-btn:hover {
      background: #f59e0b;
      color: #000;
      border-color: #f59e0b;
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.7);
      transform: translateY(-1px);
    }

    /* ─── Center Container ───────────────────────── */
    .center-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      flex: 1;
      position: relative;
      z-index: 2;
      max-width: 580px;
      width: 100%;
      margin: 16px 0;
    }

    .domain-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(14, 14, 28, 0.85);
      border: 1px solid rgba(124, 58, 237, 0.35);
      border-radius: 12px;
      padding: 8px 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 0 20px rgba(124,58,237,0.15);
    }
    .domain-title {
      font-size: clamp(10px, 1.4vw, 13px);
      color: #f4f4ff;
      line-height: 1.4;
    }
    .domain-name {
      color: #c084fc;
      text-shadow: 0 0 10px rgba(192, 132, 252, 0.5);
    }

    /* ─── Sprite & Pedestal ──────────────────────── */
    .sprite-wrapper {
      position: relative;
      width: 160px;
      height: 160px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: spriteFloat 3s ease-in-out infinite alternate;
    }

    @keyframes spriteFloat {
      0%   { transform: translateY(0px);   filter: drop-shadow(0 0 12px rgba(124,58,237,0.4)); }
      100% { transform: translateY(-12px); filter: drop-shadow(0 0 26px rgba(124,58,237,0.8)) drop-shadow(0 0 40px rgba(245,158,11,0.5)); }
    }

    .sprite-img {
      width: 135px;
      height: 135px;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      user-select: none;
      z-index: 2;
      position: relative;
    }

    .sprite-pedestal {
      position: absolute;
      bottom: 6px;
      width: 110px;
      height: 22px;
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(124,58,237,0.6) 0%, rgba(245,158,11,0.2) 60%, transparent 80%);
      border: 1px solid rgba(124,58,237,0.4);
      box-shadow: 0 0 18px rgba(124,58,237,0.5);
      animation: pedestalPulse 2s ease-in-out infinite alternate;
    }

    @keyframes pedestalPulse {
      0%   { transform: scale(0.95); opacity: 0.6; }
      100% { transform: scale(1.1);  opacity: 1; }
    }

    /* ─── Quote Banner ───────────────────────────── */
    .quote-card {
      background: rgba(18, 18, 36, 0.75);
      border: 1px solid rgba(124, 58, 237, 0.25);
      border-left: 3px solid #7c3aed;
      border-radius: 10px;
      padding: 10px 16px;
      font-family: 'Nunito', sans-serif;
      font-size: 12px;
      font-style: italic;
      color: #cbd5e1;
      text-align: center;
      line-height: 1.5;
      width: 100%;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .quote-author {
      font-family: 'Press Start 2P', monospace;
      font-size: 7px;
      font-style: normal;
      color: #94a3b8;
      display: block;
      margin-top: 5px;
    }

    /* ─── RPG Gold & Stats Banner ────────────────── */
    .rpg-stats-card {
      width: 100%;
      background: rgba(18, 18, 34, 0.85);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: 14px;
      padding: 14px 20px;
      backdrop-filter: blur(8px);
      box-shadow: 0 6px 24px rgba(0,0,0,0.5), inset 0 0 20px rgba(245, 158, 11, 0.05);
    }

    .rpg-stats-grid {
      display: flex;
      align-items: center;
      justify-content: space-around;
      gap: 12px;
    }

    .rpg-stat-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .rpg-stat-val {
      font-size: 16px;
      color: #fff;
      text-shadow: 0 0 10px rgba(245,158,11,0.6);
    }

    .rpg-stat-val.low-gold {
      color: #ef4444;
      text-shadow: 0 0 10px rgba(239,68,68,0.6);
    }

    .rpg-stat-lbl {
      font-size: 7px;
      color: rgba(245, 158, 11, 0.75);
      letter-spacing: 0.06em;
    }

    .rpg-stat-sep {
      font-size: 18px;
      color: rgba(245, 158, 11, 0.25);
    }

    /* ─── Pay Button ─────────────────────────────── */
    .pay-btn {
      background: linear-gradient(135deg, rgba(20, 20, 36, 0.95), rgba(124, 58, 237, 0.25));
      border: 2px solid #f59e0b;
      color: #f59e0b;
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(10px, 1.3vw, 14px);
      padding: 16px 36px;
      border-radius: 30px;
      cursor: pointer;
      box-shadow:
        0 0 24px rgba(245,158,11,0.5),
        inset 0 0 12px rgba(245,158,11,0.18);
      transition: all 0.2s ease;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      animation: btnPulse 2.2s ease-in-out infinite;
      width: 100%;
    }

    @keyframes btnPulse {
      0%, 100% { box-shadow: 0 0 20px rgba(245,158,11,0.45), inset 0 0 10px rgba(245,158,11,0.15); }
      50%       { box-shadow: 0 0 36px rgba(245,158,11,0.85), inset 0 0 18px rgba(245,158,11,0.30); }
    }

    .pay-btn:hover:not(:disabled) {
      background: #f59e0b;
      color: #000;
      border-color: #f59e0b;
      box-shadow: 0 0 46px rgba(245,158,11,1), 0 0 65px rgba(245,158,11,0.5);
      transform: scale(1.03);
      animation: none;
    }

    .pay-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      animation: none;
    }

    .pay-btn.success {
      background: linear-gradient(135deg, #16a34a, #22c55e);
      border-color: #22c55e;
      color: #fff;
      box-shadow: 0 0 32px rgba(34,197,94,0.7);
      animation: none;
    }

    /* ─── Status Message ─────────────────────────── */
    .status-msg {
      font-size: 9px;
      text-align: center;
      min-height: 20px;
      text-shadow: 0 0 8px currentColor;
      line-height: 1.6;
    }
    .status-msg.error   { color: #ef4444; }
    .status-msg.success { color: #22c55e; }

    /* ─── Shake ──────────────────────────────────── */
    @keyframes shake {
      10%, 90% { transform: translate3d(-3px, 0, 0); }
      20%, 80% { transform: translate3d(5px, 0, 0); }
      30%, 50%, 70% { transform: translate3d(-7px, 0, 0); }
      40%, 60% { transform: translate3d(7px, 0, 0); }
    }
    .shake { animation: shake 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both; }

    /* ─── Unlock Success Flash ───────────────────── */
    @keyframes flashGreen {
      0%   { background: rgba(6,6,14,0.92); }
      30%  { background: rgba(34,197,94,0.25); }
      100% { background: rgba(6,6,14,0.0); }
    }
    .backdrop.unlocking { animation: flashGreen 0.6s ease-out forwards; }
  `;
  shadow.appendChild(styleEl);

  // Build DOM
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  backdrop.innerHTML = `
    <div class="top-bar">
      <div class="guardian-tag">🛡️ MIND OS GUARDIAN</div>
      <button class="reload-btn" id="reloadBtn">↻ Reload</button>
    </div>

    <div class="center-container">
      <div class="domain-badge">
        <span style="font-size: 14px;">🌐</span>
        <span class="domain-title">ACCESS RESTRICTED: <strong class="domain-name">${domain}</strong></span>
      </div>

      <div class="sprite-wrapper">
        <img src="${characterImgUrl}" alt="Beatrix" class="sprite-img" />
        <div class="sprite-pedestal"></div>
      </div>

      <div class="quote-card">
        <p>"The Void claims those who succumb to distraction. Stay focused, Adventurer!"</p>
        <span class="quote-author">— BEATRIX (MIND OS GUARDIAN)</span>
      </div>

      <div class="rpg-stats-card">
        <div class="rpg-stats-grid">
          <div class="rpg-stat-col">
            <span class="rpg-stat-val ${hasEnoughGold ? '' : 'low-gold'}" id="yourGoldDisplay">${goldDisplay}</span>
            <span class="rpg-stat-lbl">🪙 YOUR GOLD</span>
          </div>
          <div class="rpg-stat-sep">•</div>
          <div class="rpg-stat-col">
            <span class="rpg-stat-val">${costDisplay}</span>
            <span class="rpg-stat-lbl">💸 UNLOCK COST</span>
          </div>
          <div class="rpg-stat-sep">•</div>
          <div class="rpg-stat-col">
            <span class="rpg-stat-val">${durationDisplay}m</span>
            <span class="rpg-stat-lbl">⏱ DURATION</span>
          </div>
        </div>
      </div>

      <button class="pay-btn" id="payBtn">[ PAY ${costDisplay} GOLD TO PASS ]</button>
      <div class="status-msg" id="statusMsg"></div>
    </div>
  `;

  shadow.appendChild(backdrop);

  // Restore page visibility now that overlay is mounted
  document.documentElement.style.visibility = '';

  // ─── Event Handlers ───────────────────────────────────────────────
  const reloadBtn = shadow.getElementById('reloadBtn');
  const payBtn    = shadow.getElementById('payBtn');
  const statusMsg = shadow.getElementById('statusMsg');

  reloadBtn.addEventListener('click', () => window.location.reload());

  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.textContent = 'UNLOCKING...';
    statusMsg.className = 'status-msg';
    statusMsg.textContent = '';

    try {
      const unlockRes = await browser.runtime.sendMessage({
        type: 'UNLOCK_SITE',
        domain: domain,
      });

      if (unlockRes?.ok) {
        payBtn.className = 'pay-btn success';
        payBtn.textContent = '✓ UNLOCKED!';
        backdrop.classList.add('unlocking');

        // Calculate remaining time from server's unlocked_until
        const unlockedUntil = unlockRes.unlocked_until
          ? new Date(unlockRes.unlocked_until)
          : new Date(Date.now() + durationDisplay * 60 * 1000);

        const getRemainingStr = () => {
          const secsLeft = Math.max(0, Math.ceil((unlockedUntil - Date.now()) / 1000));
          const m = Math.floor(secsLeft / 60);
          const s = secsLeft % 60;
          return `${m}:${String(s).padStart(2, '0')} remaining`;
        };

        statusMsg.className = 'status-msg success';
        statusMsg.textContent = `✓ Access granted! ${getRemainingStr()}`;

        // Remove overlay after 800ms
        setTimeout(() => {
          document.documentElement.style.overflow = '';
          host.remove();
        }, 800);

      } else {
        payBtn.disabled = false;
        payBtn.textContent = '[ Pay To Pass ]';
        payBtn.classList.add('shake');
        setTimeout(() => payBtn.classList.remove('shake'), 450);

        statusMsg.className = 'status-msg error';
        if (unlockRes?.error === 'insufficient_gold') {
          const have = Math.round(Number(unlockRes.gold ?? 0));
          statusMsg.textContent = `Not enough gold! Have: ${have} 🪙  Need: ${costDisplay} 🪙`;
          const goldEl = shadow.getElementById('yourGoldDisplay');
          if (goldEl) goldEl.textContent = have;
        } else {
          statusMsg.textContent = 'Unlock failed. Check connection.';
        }
      }
    } catch (err) {
      console.error('[MIND OS] Overlay unlock error:', err);
      payBtn.disabled = false;
      payBtn.textContent = '[ Pay To Pass ]';
      statusMsg.className = 'status-msg error';
      statusMsg.textContent = 'Network error. Try again.';
    }
  });

})();
