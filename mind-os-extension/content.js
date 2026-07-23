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

  // Inject styles into shadow DOM
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

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
      background: rgba(6, 6, 14, 0.92);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 20px 48px;
      color: #f59e0b;
      animation: fadeIn 0.25s ease-out;
      gap: 0;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* ─── Top Banner ─────────────────────────────── */
    .top-bar {
      width: 100%;
      max-width: 860px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 0;
    }

    .reload-btn {
      background: rgba(0,0,0,0.5);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #f59e0b;
      font-family: 'Press Start 2P', monospace;
      font-size: 10px;
      padding: 9px 14px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .reload-btn:hover {
      background: #f59e0b;
      color: #000;
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.7);
    }

    .banner-center {
      flex: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .banner-title {
      font-size: clamp(11px, 1.6vw, 16px);
      color: #f59e0b;
      line-height: 1.6;
      text-shadow: 0 0 14px rgba(245, 158, 11, 0.5);
    }

    .banner-sub {
      font-size: clamp(10px, 1.4vw, 14px);
      color: #fbbf24;
      line-height: 1.6;
      text-shadow: 0 0 10px rgba(245, 158, 11, 0.4);
    }

    /* ─── Center ──────────────────────────────────── */
    .center-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 28px;
      flex: 1;
    }

    .sprite-wrapper {
      width: 150px;
      height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: spriteFloat 2.8s ease-in-out infinite alternate;
    }

    @keyframes spriteFloat {
      0%   { transform: translateY(0px);   filter: drop-shadow(0 0 16px rgba(245,158,11,0.5)); }
      100% { transform: translateY(-14px); filter: drop-shadow(0 0 30px rgba(245,158,11,0.9)) drop-shadow(0 0 50px rgba(124,58,237,0.6)); }
    }

    .sprite-emoji {
      font-size: 88px;
      line-height: 1;
      user-select: none;
      image-rendering: pixelated;
    }

    /* ─── Gold Info Row ──────────────────────────── */
    .gold-info {
      display: flex;
      align-items: center;
      gap: 18px;
      background: rgba(245,158,11,0.08);
      border: 1px solid rgba(245,158,11,0.25);
      border-radius: 12px;
      padding: 10px 20px;
      font-size: 10px;
      color: #fbbf24;
    }
    .gold-info-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .gold-val {
      font-size: 18px;
      color: #fff;
      text-shadow: 0 0 10px rgba(245,158,11,0.6);
    }
    .gold-lbl {
      font-size: 8px;
      color: rgba(245,158,11,0.7);
    }
    .gold-sep {
      font-size: 20px;
      color: rgba(245,158,11,0.3);
    }

    /* ─── Pay Button ─────────────────────────────── */
    .pay-btn {
      background: rgba(10,10,18,0.88);
      border: 2px solid #f59e0b;
      color: #f59e0b;
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(11px, 1.4vw, 15px);
      padding: 18px 42px;
      border-radius: 32px;
      cursor: pointer;
      box-shadow:
        0 0 24px rgba(245,158,11,0.55),
        inset 0 0 12px rgba(245,158,11,0.18);
      transition: all 0.18s ease;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      animation: btnPulse 2s ease-in-out infinite;
    }

    @keyframes btnPulse {
      0%, 100% { box-shadow: 0 0 24px rgba(245,158,11,0.55), inset 0 0 12px rgba(245,158,11,0.18); }
      50%       { box-shadow: 0 0 42px rgba(245,158,11,0.85), inset 0 0 20px rgba(245,158,11,0.32); }
    }

    .pay-btn:hover:not(:disabled) {
      background: #f59e0b;
      color: #000;
      box-shadow: 0 0 50px rgba(245,158,11,1), 0 0 70px rgba(245,158,11,0.5);
      transform: scale(1.06);
      animation: none;
    }

    .pay-btn:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      animation: none;
    }

    .pay-btn.success {
      background: #22c55e;
      border-color: #22c55e;
      color: #fff;
      box-shadow: 0 0 30px rgba(34,197,94,0.7);
      animation: none;
    }

    /* ─── Error / Success Message ────────────────── */
    .status-msg {
      font-size: 10px;
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
      <button class="reload-btn" id="reloadBtn">↻ Reload</button>
      <div class="banner-center">
        <div class="banner-title">You're trying to Access www.${domain}</div>
        <div class="banner-sub">Pay ${costDisplay} Gold to access for ${durationDisplay} Minutes</div>
      </div>
    </div>

    <div class="center-container">
      <div class="sprite-wrapper">
        <span class="sprite-emoji">🧙‍♂️</span>
      </div>

      <div class="gold-info">
        <div class="gold-info-item">
          <span class="gold-val" id="yourGoldDisplay">${goldDisplay}</span>
          <span class="gold-lbl">🪙 YOUR GOLD</span>
        </div>
        <div class="gold-sep">•</div>
        <div class="gold-info-item">
          <span class="gold-val">${costDisplay}</span>
          <span class="gold-lbl">💸 COST</span>
        </div>
        <div class="gold-sep">•</div>
        <div class="gold-info-item">
          <span class="gold-val">${durationDisplay}m</span>
          <span class="gold-lbl">⏱ ACCESS</span>
        </div>
      </div>

      <button class="pay-btn" id="payBtn">[ Pay To Pass ]</button>
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
