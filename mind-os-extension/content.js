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
      background: radial-gradient(circle at 50% 30%, rgba(139, 0, 0, 0.35) 0%, rgba(45, 10, 70, 0.5) 45%, #05040a 85%);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 28px 20px 40px;
      color: #f59e0b;
      animation: fadeIn 0.25s ease-out;
      overflow-y: auto;
    }

    /* Subtle Dark Fantasy Background Grid */
    .backdrop::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(139, 0, 0, 0.08) 2px, transparent 2px),
        linear-gradient(90deg, rgba(139, 0, 0, 0.08) 2px, transparent 2px);
      background-size: 32px 32px;
      pointer-events: none;
    }

    /* CRT Scanline Overlay */
    .backdrop::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.35) 50%);
      background-size: 100% 4px;
      pointer-events: none;
      z-index: 10;
      opacity: 0.5;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to   { opacity: 1; transform: scale(1); }
    }

    /* ─── Top Banner ─────────────────────────────── */
    .top-bar {
      width: 100%;
      max-width: 820px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: relative;
      z-index: 20;
    }

    .guardian-tag {
      font-size: 11px;
      color: #e9d5ff;
      background: #180924;
      border: 2px solid #a855f7;
      padding: 8px 16px;
      border-radius: 4px;
      letter-spacing: 0.08em;
      box-shadow: 0 0 16px rgba(168, 85, 247, 0.4), inset 0 0 8px rgba(168, 85, 247, 0.2);
      text-shadow: 1px 1px 0 #000;
    }

    .reload-btn {
      background: #12091c;
      border: 2px solid #f59e0b;
      color: #f59e0b;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      padding: 10px 18px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
      flex-shrink: 0;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
      text-shadow: 1px 1px 0 #000;
    }
    .reload-btn:hover {
      background: #f59e0b;
      color: #000;
      box-shadow: 0 0 24px rgba(245, 158, 11, 0.8);
      transform: translateY(-2px);
      text-shadow: none;
    }

    /* ─── Center Container ───────────────────────── */
    .center-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 22px;
      flex: 1;
      position: relative;
      z-index: 20;
      max-width: 640px;
      width: 100%;
      margin: 20px 0;
    }

    .domain-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: #0c0814;
      border: 3px solid #8b0000;
      outline: 2px solid #f59e0b;
      outline-offset: -5px;
      border-radius: 4px;
      padding: 12px 24px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.8), 0 0 20px rgba(139, 0, 0, 0.5);
    }
    .domain-title {
      font-size: 13px;
      color: #f4f4ff;
      line-height: 1.6;
      text-shadow: 1px 1px 0 #000;
    }
    .domain-name {
      color: #c084fc;
      font-size: 15px;
      text-shadow: 0 0 12px rgba(192, 132, 252, 0.8), 1px 1px 0 #000;
    }

    /* ─── Sprite & Pedestal Frame ────────────────── */
    .sprite-wrapper {
      position: relative;
      width: 180px;
      height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      background: #12081d;
      border: 3px solid #f59e0b;
      box-shadow: 0 0 0 3px #8b0000, 0 0 30px rgba(245, 158, 11, 0.4), inset 0 0 15px rgba(0,0,0,0.8);
      border-radius: 4px;
      animation: spriteFloat 3.5s ease-in-out infinite alternate;
    }

    @keyframes spriteFloat {
      0%   { transform: translateY(0px);   filter: drop-shadow(0 0 15px rgba(168,85,247,0.5)); }
      100% { transform: translateY(-10px); filter: drop-shadow(0 0 30px rgba(245,158,11,0.8)) drop-shadow(0 0 45px rgba(139,0,0,0.6)); }
    }

    .sprite-img {
      width: 150px;
      height: 150px;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      user-select: none;
      z-index: 2;
      position: relative;
    }

    .sprite-pedestal {
      position: absolute;
      bottom: 8px;
      width: 130px;
      height: 24px;
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(168,85,247,0.7) 0%, rgba(245,158,11,0.3) 60%, transparent 80%);
      border: 1px solid rgba(245,158,11,0.5);
      box-shadow: 0 0 22px rgba(168,85,247,0.6);
      animation: pedestalPulse 2s ease-in-out infinite alternate;
    }

    @keyframes pedestalPulse {
      0%   { transform: scale(0.92); opacity: 0.7; }
      100% { transform: scale(1.1);  opacity: 1; }
    }

    /* ─── Quote Card ─────────────────────────────── */
    .quote-card {
      background: rgba(15, 7, 26, 0.92);
      border: 3px solid #8b0000;
      border-left: 6px solid #f59e0b;
      border-radius: 4px;
      padding: 18px 22px;
      font-family: 'Press Start 2P', monospace;
      font-size: 11px;
      color: #f3e8ff;
      text-align: center;
      line-height: 1.8;
      width: 100%;
      box-shadow: 0 8px 25px rgba(0,0,0,0.85), inset 0 0 15px rgba(139,0,0,0.2);
      text-shadow: 1px 1px 0 #000;
    }
    .quote-author {
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      color: #f59e0b;
      display: block;
      margin-top: 10px;
      letter-spacing: 0.05em;
    }

    /* ─── RPG Gold & Stats Banner ────────────────── */
    .rpg-stats-card {
      width: 100%;
      background: rgba(14, 8, 24, 0.95);
      border: 3px solid #f59e0b;
      border-radius: 4px;
      padding: 18px 24px;
      box-shadow: inset 0 0 20px rgba(245, 158, 11, 0.15), 0 0 30px rgba(0,0,0,0.9);
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
      gap: 6px;
    }

    .rpg-stat-val {
      font-size: 24px;
      color: #ffffff;
      text-shadow: 2px 2px 0 #000, 0 0 12px rgba(245,158,11,0.8);
    }

    .rpg-stat-val.low-gold {
      color: #ef4444;
      text-shadow: 2px 2px 0 #000, 0 0 12px rgba(239,68,68,0.8);
    }

    .rpg-stat-lbl {
      font-size: 10px;
      color: #d97706;
      letter-spacing: 0.06em;
      text-shadow: 1px 1px 0 #000;
    }

    .rpg-stat-sep {
      font-size: 24px;
      color: #78350f;
      text-shadow: 1px 1px 0 #000;
    }

    /* ─── Pay Button ─────────────────────────────── */
    .pay-btn {
      background: linear-gradient(180deg, #b45309 0%, #78350f 100%);
      border: 3px solid #f59e0b;
      color: #ffffff;
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(12px, 1.6vw, 16px);
      padding: 20px 32px;
      border-radius: 4px;
      cursor: pointer;
      box-shadow:
        0 0 0 2px #451a03,
        0 0 28px rgba(245,158,11,0.6),
        inset 0 2px 0 rgba(255,255,255,0.3);
      transition: all 0.2s ease;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-shadow: 2px 2px 0 #000, 0 0 10px #f59e0b;
      animation: btnPulse 2.2s ease-in-out infinite;
      width: 100%;
    }

    @keyframes btnPulse {
      0%, 100% { box-shadow: 0 0 0 2px #451a03, 0 0 22px rgba(245,158,11,0.5), inset 0 2px 0 rgba(255,255,255,0.3); }
      50%       { box-shadow: 0 0 0 2px #451a03, 0 0 40px rgba(245,158,11,0.9), inset 0 2px 0 rgba(255,255,255,0.5); }
    }

    .pay-btn:hover:not(:disabled) {
      background: linear-gradient(180deg, #f59e0b 0%, #b45309 100%);
      color: #ffffff;
      box-shadow: 0 0 0 2px #451a03, 0 0 50px rgba(245,158,11,1), 0 0 70px rgba(245,158,11,0.6);
      transform: scale(1.02);
      animation: none;
    }

    .pay-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      animation: none;
    }

    .pay-btn.success {
      background: linear-gradient(180deg, #16a34a 0%, #15803d 100%);
      border-color: #22c55e;
      color: #fff;
      box-shadow: 0 0 35px rgba(34,197,94,0.8);
      animation: none;
    }

    /* ─── Status Message ─────────────────────────── */
    .status-msg {
      font-size: 11px;
      text-align: center;
      min-height: 22px;
      text-shadow: 1px 1px 0 #000, 0 0 10px currentColor;
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
      0%   { background: rgba(5,4,10,0.95); }
      30%  { background: rgba(34,197,94,0.3); }
      100% { background: rgba(5,4,10,0.0); }
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
