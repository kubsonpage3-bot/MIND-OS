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

  const costDisplay     = Math.round(Number(unlockCost));
  const durationDisplay = Math.round(Number(unlockDuration));
  const goldDisplay     = Math.round(Number(gold));

  const characterImgUrl = browser.runtime.getURL('icons/pixel_wizard_guardian.png');
  const hasEnoughGold   = goldDisplay >= costDisplay;
  const goldPct         = hasEnoughGold ? 100 : Math.round((goldDisplay / costDisplay) * 100);

  // ── STYLES ──────────────────────────────────────────────────────────────────
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      all: initial;
      display: block;
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      pointer-events: auto;
      font-family: 'Press Start 2P', monospace;
    }

    /* ── BACKDROP ─────────────────────────────────────────────── */
    .backdrop {
      position: fixed;
      inset: 0;
      width: 100%; height: 100%;
      background:
        radial-gradient(ellipse 80% 40% at 50% 0%,   rgba(100,0,180,0.20) 0%, transparent 70%),
        radial-gradient(ellipse 80% 40% at 50% 100%, rgba(139,0,0,0.22)   0%, transparent 70%),
        radial-gradient(ellipse 60% 60% at 80% 50%,  rgba(60,0,120,0.10)  0%, transparent 70%),
        #04030a;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow: hidden;
      animation: backdropIn 0.35s ease-out;
    }
    @keyframes backdropIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    /* Animated pixel grid bg */
    .backdrop::before {
      content: '';
      position: absolute;
      inset: -32px;
      background-image:
        linear-gradient(rgba(120,58,237,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(120,58,237,0.06) 1px, transparent 1px);
      background-size: 32px 32px;
      animation: gridDrift 14s linear infinite;
      pointer-events: none;
    }
    @keyframes gridDrift {
      0%   { transform: translate(0, 0); }
      100% { transform: translate(32px, 32px); }
    }

    /* CRT scanlines */
    .backdrop::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent,
        transparent 3px,
        rgba(0,0,0,0.14) 3px,
        rgba(0,0,0,0.14) 4px
      );
      pointer-events: none;
      z-index: 200;
    }

    /* ── CORNER RUNES ─────────────────────────────────────────── */
    .corner {
      position: absolute;
      width: 52px; height: 52px;
      z-index: 10;
      pointer-events: none;
    }
    .corner-tl { top: 14px;    left: 14px; }
    .corner-tr { top: 14px;    right: 14px;  transform: scaleX(-1); }
    .corner-bl { bottom: 14px; left: 14px;   transform: scaleY(-1); }
    .corner-br { bottom: 14px; right: 14px;  transform: scale(-1,-1); }

    /* ── PARTICLES ────────────────────────────────────────────── */
    .particles {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 3;
    }
    .p {
      position: absolute;
      bottom: -8px;
      width: 4px; height: 4px;
      image-rendering: pixelated;
      animation: pRise linear infinite;
      opacity: 0;
    }
    .p:nth-child(1)  { left:5%;   width:5px;height:5px; animation-duration:7.2s; animation-delay:0s;    background:#7c3aed; box-shadow:0 0 5px rgba(124,58,237,.9); }
    .p:nth-child(2)  { left:12%;  width:3px;height:3px; animation-duration:5.8s; animation-delay:1.1s;  background:#a855f7; }
    .p:nth-child(3)  { left:22%;  width:6px;height:6px; animation-duration:8.5s; animation-delay:0.4s;  background:#f59e0b; box-shadow:0 0 6px rgba(245,158,11,.9); }
    .p:nth-child(4)  { left:32%;  width:4px;height:4px; animation-duration:6.0s; animation-delay:2.1s;  background:#7c3aed; }
    .p:nth-child(5)  { left:44%;  width:5px;height:5px; animation-duration:9.0s; animation-delay:0.7s;  background:#ef4444; box-shadow:0 0 6px rgba(239,68,68,.8); }
    .p:nth-child(6)  { left:56%;  width:3px;height:3px; animation-duration:6.7s; animation-delay:1.5s;  background:#a855f7; }
    .p:nth-child(7)  { left:66%;  width:5px;height:5px; animation-duration:7.8s; animation-delay:0.2s;  background:#f59e0b; box-shadow:0 0 6px rgba(245,158,11,.9); }
    .p:nth-child(8)  { left:76%;  width:4px;height:4px; animation-duration:5.5s; animation-delay:1.8s;  background:#7c3aed; }
    .p:nth-child(9)  { left:86%;  width:6px;height:6px; animation-duration:8.2s; animation-delay:0.9s;  background:#ef4444; box-shadow:0 0 6px rgba(239,68,68,.7); }
    .p:nth-child(10) { left:94%;  width:3px;height:3px; animation-duration:6.3s; animation-delay:2.5s;  background:#a855f7; }
    @keyframes pRise {
      0%   { opacity:0;   transform:translateY(0) rotate(0deg); }
      8%   { opacity:.9; }
      92%  { opacity:.3; }
      100% { opacity:0;   transform:translateY(-100vh) rotate(360deg); }
    }

    /* ── MAIN PANEL ───────────────────────────────────────────── */
    .panel {
      position: relative;
      z-index: 20;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 13px;
      width: 100%;
      max-width: 580px;
    }

    /* ── TOP BAR ──────────────────────────────────────────────── */
    .top-bar {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .guardian-tag {
      font-size: 9px;
      color: #c4b5fd;
      background: linear-gradient(135deg, #0d0620 0%, #1a0a30 100%);
      border: 2px solid #7c3aed;
      padding: 8px 14px;
      letter-spacing: 0.09em;
      box-shadow: 0 0 16px rgba(124,58,237,0.4), inset 0 0 8px rgba(124,58,237,0.08);
      text-shadow: 0 0 8px rgba(196,181,253,0.7);
      clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
      animation: tagGlow 3s ease-in-out infinite alternate;
    }
    @keyframes tagGlow {
      0%   { box-shadow: 0 0 10px rgba(124,58,237,0.3), inset 0 0 6px rgba(124,58,237,0.05); }
      100% { box-shadow: 0 0 22px rgba(124,58,237,0.7), inset 0 0 12px rgba(124,58,237,0.15); }
    }
    .reload-btn {
      background: #0c0a14;
      border: 2px solid #f59e0b;
      color: #f59e0b;
      font-family: 'Press Start 2P', monospace;
      font-size: 9px;
      padding: 8px 14px;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 0 10px rgba(245,158,11,0.25);
      text-shadow: 0 0 6px rgba(245,158,11,0.6);
      clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
    }
    .reload-btn:hover {
      background: #f59e0b;
      color: #000;
      box-shadow: 0 0 28px rgba(245,158,11,1);
      transform: translateY(-1px);
      text-shadow: none;
    }

    /* ── DOMAIN BADGE ─────────────────────────────────────────── */
    .domain-badge {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: #080511;
      border: 2px solid #8b0000;
      border-top-color: #c84b4b;
      padding: 10px 18px;
      box-shadow: 0 0 22px rgba(139,0,0,0.45), inset 0 0 10px rgba(139,0,0,0.08);
    }
    .access-label {
      font-size: 9px;
      color: #e5d3ff;
      text-shadow: 1px 1px 0 #000;
      letter-spacing: 0.05em;
    }
    .domain-name {
      color: #f87171;
      font-size: 11px;
      animation: glitch 5s infinite;
      text-shadow: 0 0 10px rgba(248,113,113,0.8), 2px 0 rgba(124,58,237,0.5), -2px 0 rgba(245,158,11,0.4);
    }
    @keyframes glitch {
      0%,93%,100% {
        text-shadow: 0 0 10px rgba(248,113,113,0.8), 2px 0 rgba(124,58,237,0.5), -2px 0 rgba(245,158,11,0.4);
        transform: none; clip-path: none;
      }
      94% { transform: translate(-2px,0) skewX(-8deg); clip-path: polygon(0 15%,100% 15%,100% 35%,0 35%); color:#c084fc; }
      95% { transform: translate(3px,0)  skewX(6deg);  clip-path: polygon(0 55%,100% 55%,100% 75%,0 75%); color:#f59e0b; }
      96% { transform: none; clip-path: none; color:#f87171; }
    }

    /* ── SPRITE ───────────────────────────────────────────────── */
    .sprite-frame {
      position: relative;
      width: 158px; height: 158px;
      display: flex; align-items: center; justify-content: center;
      background: #070415;
      border: 3px solid #f59e0b;
      box-shadow:
        0 0 0 2px #3b1c08,
        0 0 0 4px #04030a,
        0 0 32px rgba(245,158,11,0.35),
        inset 0 0 24px rgba(0,0,0,0.95);
      animation: float 3.8s ease-in-out infinite alternate;
    }
    /* Pixel corner accents */
    .sprite-frame::before {
      content: '';
      position: absolute;
      top: -6px; left: -6px;
      width: 16px; height: 16px;
      border-top: 3px solid #f59e0b;
      border-left: 3px solid #f59e0b;
    }
    .sprite-frame::after {
      content: '';
      position: absolute;
      bottom: -6px; right: -6px;
      width: 16px; height: 16px;
      border-bottom: 3px solid #f59e0b;
      border-right: 3px solid #f59e0b;
    }
    /* Additional corners via wrapper pseudo — use inner div instead */
    .sprite-corner-br, .sprite-corner-tl-inner {
      display: none;
    }
    @keyframes float {
      0%   { transform:translateY(0);    filter:drop-shadow(0 0 12px rgba(168,85,247,0.5)); }
      100% { transform:translateY(-10px);filter:drop-shadow(0 0 30px rgba(245,158,11,1)) drop-shadow(0 0 60px rgba(139,0,0,0.5)); }
    }
    .sprite-img {
      width: 128px; height: 128px;
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      user-select: none;
      position: relative;
      z-index: 2;
    }
    .sprite-orb {
      position: absolute;
      bottom: 7px;
      width: 100px; height: 14px;
      border-radius: 50%;
      background: radial-gradient(ellipse, rgba(168,85,247,0.75) 0%, rgba(245,158,11,0.2) 60%, transparent 80%);
      animation: orbPulse 2.2s ease-in-out infinite alternate;
    }
    @keyframes orbPulse {
      0%   { opacity:0.5; transform:scaleX(0.8); }
      100% { opacity:1;   transform:scaleX(1.15); }
    }

    /* ── QUOTE ────────────────────────────────────────────────── */
    .quote-card {
      width: 100%;
      background: rgba(8,4,18,0.97);
      border-left: 4px solid #f59e0b;
      border-right: 4px solid #7c3aed;
      border-top: 2px solid #1e0d3a;
      border-bottom: 2px solid #1e0d3a;
      padding: 13px 18px;
      font-size: 8px;
      color: #ddd6fe;
      line-height: 2.2;
      text-align: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.85), inset 0 0 10px rgba(124,58,237,0.04);
      text-shadow: 1px 1px 0 #000;
    }
    .quote-author {
      font-size: 7px;
      color: #f59e0b;
      display: block;
      margin-top: 8px;
      letter-spacing: 0.09em;
      text-shadow: 0 0 7px rgba(245,158,11,0.7);
    }

    /* ── STATS CARD ───────────────────────────────────────────── */
    .stats-card {
      width: 100%;
      background: #060310;
      border: 2px solid #f59e0b;
      border-top-color: #fbbf24;
      padding: 14px 18px;
      box-shadow: inset 0 0 16px rgba(245,158,11,0.06), 0 0 28px rgba(0,0,0,0.95);
    }
    .stats-grid {
      display: flex;
      align-items: center;
      justify-content: space-around;
    }
    .stat-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .stat-val {
      font-size: 22px;
      color: #fff;
      text-shadow: 2px 2px 0 #000, 0 0 16px rgba(245,158,11,0.9);
    }
    .stat-val.danger {
      color: #ef4444;
      text-shadow: 2px 2px 0 #000, 0 0 16px rgba(239,68,68,1);
      animation: dangerPulse 1s ease-in-out infinite;
    }
    @keyframes dangerPulse {
      0%,100% { text-shadow:2px 2px 0 #000, 0 0 10px rgba(239,68,68,.7); }
      50%     { text-shadow:2px 2px 0 #000, 0 0 26px rgba(239,68,68,1), 0 0 50px rgba(239,68,68,.35); }
    }
    .stat-lbl {
      font-size: 7px;
      color: #b45309;
      letter-spacing: 0.06em;
      text-shadow: 1px 1px 0 #000;
    }
    .stat-sep {
      font-size: 18px;
      color: #3b1c08;
      text-shadow: 1px 1px 0 #000;
    }
    /* Gold deficit bar */
    .deficit-wrap {
      margin-top: 12px;
    }
    .deficit-label {
      display: flex;
      justify-content: space-between;
      font-size: 7px;
      color: #ef4444;
      margin-bottom: 5px;
      text-shadow: 1px 1px 0 #000;
    }
    .deficit-track {
      width: 100%;
      height: 8px;
      background: #1a0808;
      border: 1px solid #7f1d1d;
      overflow: hidden;
    }
    .deficit-fill {
      height: 100%;
      background: linear-gradient(90deg, #ef4444, #b91c1c);
      box-shadow: 0 0 8px rgba(239,68,68,0.7);
      image-rendering: pixelated;
    }

    /* ── PAY BUTTON ───────────────────────────────────────────── */
    .pay-btn {
      width: 100%;
      background: linear-gradient(180deg, #92400e 0%, #451a03 60%, #78350f 100%);
      border: 3px solid #f59e0b;
      border-top-color: #fbbf24;
      border-bottom-color: #78350f;
      color: #fff;
      font-family: 'Press Start 2P', monospace;
      font-size: clamp(10px, 1.5vw, 14px);
      padding: 18px 24px;
      cursor: pointer;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-shadow: 2px 2px 0 #000, 0 0 10px rgba(245,158,11,0.5);
      box-shadow:
        0 0 0 2px #451a03,
        0 0 0 4px #04030a,
        0 0 30px rgba(245,158,11,0.5);
      transition: all 0.15s;
      animation: btnPulse 2.5s ease-in-out infinite;
      clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
    }
    @keyframes btnPulse {
      0%,100% { box-shadow:0 0 0 2px #451a03,0 0 0 4px #04030a,0 0 20px rgba(245,158,11,0.4); }
      50%      { box-shadow:0 0 0 2px #451a03,0 0 0 4px #04030a,0 0 50px rgba(245,158,11,1), 0 0 90px rgba(245,158,11,0.2); }
    }
    .pay-btn:hover:not(:disabled) {
      background: linear-gradient(180deg, #f59e0b 0%, #d97706 60%, #b45309 100%);
      color: #000;
      text-shadow: none;
      box-shadow: 0 0 0 2px #451a03, 0 0 0 4px #04030a, 0 0 65px rgba(245,158,11,1);
      transform: translateY(-2px) scale(1.01);
      animation: none;
    }
    .pay-btn:disabled { opacity:.5; cursor:not-allowed; animation:none; }
    .pay-btn.success {
      background: linear-gradient(180deg, #16a34a 0%, #14532d 60%, #15803d 100%);
      border-color: #22c55e;
      text-shadow: 2px 2px 0 #000, 0 0 12px rgba(34,197,94,.8);
      box-shadow: 0 0 0 2px #14532d, 0 0 0 4px #04030a, 0 0 45px rgba(34,197,94,.8);
      animation: none;
    }

    /* ── STATUS ───────────────────────────────────────────────── */
    .status-msg {
      font-size: 8px;
      text-align: center;
      min-height: 16px;
      line-height: 1.6;
      text-shadow: 1px 1px 0 #000;
      color: transparent;
    }
    .status-msg.error   { color:#ef4444; text-shadow:1px 1px 0 #000, 0 0 8px rgba(239,68,68,.7); }
    .status-msg.success { color:#22c55e; text-shadow:1px 1px 0 #000, 0 0 8px rgba(34,197,94,.7); }

    /* ── SHAKE ────────────────────────────────────────────────── */
    @keyframes shake {
      10%,90%   { transform:translate3d(-3px,0,0); }
      20%,80%   { transform:translate3d(5px,0,0); }
      30%,50%,70%{ transform:translate3d(-6px,0,0); }
      40%,60%   { transform:translate3d(6px,0,0); }
    }
    .shake { animation:shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }

    /* ── UNLOCK FLASH ─────────────────────────────────────────── */
    @keyframes flashGreen {
      0%   { background:#04030a; }
      25%  { background:rgba(34,197,94,0.18); }
      100% { background:#04030a; }
    }
    .backdrop.unlocking { animation:flashGreen 0.7s ease-out forwards; }
  `;
  shadow.appendChild(styleEl);

  // ── CORNER SVG ────────────────────────────────────────────────────────────
  const cornerSVG = `<svg viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 50 L2 10 L10 2 L50 2" stroke="#7c3aed" stroke-width="2" opacity="0.7"/>
    <path d="M2 50 L2 28 L16 14 L50 2" stroke="#f59e0b" stroke-width="1.5" opacity="0.4"/>
    <rect x="2" y="2" width="6" height="6" fill="#7c3aed" opacity="0.5"/>
    <rect x="44" y="2" width="6" height="6" fill="#f59e0b" opacity="0.4"/>
    <rect x="2" y="44" width="6" height="6" fill="#f59e0b" opacity="0.4"/>
  </svg>`;

  // ── BUILD DOM ─────────────────────────────────────────────────────────────
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';

  backdrop.innerHTML = `
    <!-- Corner runes -->
    <div class="corner corner-tl">${cornerSVG}</div>
    <div class="corner corner-tr">${cornerSVG}</div>
    <div class="corner corner-bl">${cornerSVG}</div>
    <div class="corner corner-br">${cornerSVG}</div>

    <!-- Particles -->
    <div class="particles">
      <div class="p"></div><div class="p"></div><div class="p"></div>
      <div class="p"></div><div class="p"></div><div class="p"></div>
      <div class="p"></div><div class="p"></div><div class="p"></div>
      <div class="p"></div>
    </div>

    <!-- Main panel -->
    <div class="panel">

      <!-- Top bar -->
      <div class="top-bar">
        <div class="guardian-tag">🛡️ MIND OS GUARDIAN</div>
        <button class="reload-btn" id="reloadBtn">↻ Reload</button>
      </div>

      <!-- Domain badge -->
      <div class="domain-badge">
        <span style="font-size:14px">🌐</span>
        <span class="access-label">ACCESS RESTRICTED:</span>
        <span class="domain-name">${domain}</span>
      </div>

      <!-- Sprite frame -->
      <div class="sprite-frame">
        <img src="${characterImgUrl}" alt="Beatrix" class="sprite-img" />
        <div class="sprite-orb"></div>
      </div>

      <!-- Quote -->
      <div class="quote-card">
        <p>"The Void claims those who succumb to distraction. Stay focused, Adventurer!"</p>
        <span class="quote-author">— BEATRIX (MIND OS GUARDIAN)</span>
      </div>

      <!-- Stats -->
      <div class="stats-card">
        <div class="stats-grid">
          <div class="stat-col">
            <span class="stat-val ${hasEnoughGold ? '' : 'danger'}" id="yourGoldDisplay">${goldDisplay}</span>
            <span class="stat-lbl">🪙 YOUR GOLD</span>
          </div>
          <div class="stat-sep">◆</div>
          <div class="stat-col">
            <span class="stat-val">${costDisplay}</span>
            <span class="stat-lbl">💸 UNLOCK COST</span>
          </div>
          <div class="stat-sep">◆</div>
          <div class="stat-col">
            <span class="stat-val">${durationDisplay}m</span>
            <span class="stat-lbl">⏱ DURATION</span>
          </div>
        </div>
        ${!hasEnoughGold ? `
        <div class="deficit-wrap">
          <div class="deficit-label">
            <span>GOLD NEEDED</span>
            <span>${goldDisplay} / ${costDisplay}</span>
          </div>
          <div class="deficit-track">
            <div class="deficit-fill" style="width:${goldPct}%"></div>
          </div>
        </div>
        ` : ''}
      </div>

      <!-- Pay button -->
      <button class="pay-btn" id="payBtn">[ PAY ${costDisplay} GOLD TO PASS ]</button>
      <div class="status-msg" id="statusMsg"></div>

    </div>
  `;

  shadow.appendChild(backdrop);

  // Restore page visibility now that overlay is mounted
  document.documentElement.style.visibility = '';

  // ── EVENT HANDLERS ────────────────────────────────────────────────────────
  const reloadBtn = shadow.getElementById('reloadBtn');
  const payBtn    = shadow.getElementById('payBtn');
  const statusMsg = shadow.getElementById('statusMsg');

  reloadBtn.addEventListener('click', () => window.location.reload());

  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.textContent = '[ UNLOCKING... ]';
    statusMsg.className = 'status-msg';
    statusMsg.textContent = '';

    try {
      const unlockRes = await browser.runtime.sendMessage({
        type: 'UNLOCK_SITE',
        domain: domain,
      });

      if (unlockRes?.ok) {
        payBtn.className = 'pay-btn success';
        payBtn.textContent = '[ ✓ ACCESS GRANTED ]';
        backdrop.classList.add('unlocking');

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
        statusMsg.textContent = `✓ Unlocked! ${getRemainingStr()}`;

        setTimeout(() => {
          document.documentElement.style.overflow = '';
          host.remove();
        }, 800);

      } else {
        payBtn.disabled = false;
        payBtn.textContent = `[ PAY ${costDisplay} GOLD TO PASS ]`;
        payBtn.classList.add('shake');
        setTimeout(() => payBtn.classList.remove('shake'), 450);

        statusMsg.className = 'status-msg error';
        if (unlockRes?.error === 'insufficient_gold') {
          const have = Math.round(Number(unlockRes.gold ?? 0));
          statusMsg.textContent = `Not enough gold! Have: ${have}  Need: ${costDisplay} 🪙`;
          const goldEl = shadow.getElementById('yourGoldDisplay');
          if (goldEl) { goldEl.textContent = have; goldEl.classList.add('danger'); }
        } else {
          statusMsg.textContent = 'Unlock failed. Check connection.';
        }
      }
    } catch (err) {
      console.error('[MIND OS] Overlay unlock error:', err);
      payBtn.disabled = false;
      payBtn.textContent = `[ PAY ${costDisplay} GOLD TO PASS ]`;
      statusMsg.className = 'status-msg error';
      statusMsg.textContent = 'Network error. Try again.';
    }
  });

})();
