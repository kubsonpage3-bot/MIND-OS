// MIND OS Companion — content.js (In-Page Blocker Overlay)
// Injects pixel art overlay when user visits a blocked domain.

(async function initMindOSBlocker() {
  const currentDomain = window.location.hostname.replace(/^www\./, '').toLowerCase();
  if (!currentDomain) return;

  try {
    const res = await browser.runtime.sendMessage({
      type: 'CHECK_BLOCKED',
      domain: currentDomain,
    });

    if (!res?.isBlocked) return;

    const { domain, unlockCost, unlockDuration, gold } = res;

    // Prevent page from loading background resources / scrolling while blocked
    document.documentElement.style.overflow = 'hidden';

    // Create Shadow DOM host to prevent target page CSS leaks
    const host = document.createElement('div');
    host.id = 'mindos-overlay-host';
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Inject styles into shadow DOM
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

      :host {
        all: initial;
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
        font-family: 'Press Start 2P', monospace;
      }

      * { box-sizing: border-box; margin: 0; padding: 0; }

      .backdrop {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(8, 8, 16, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        padding: 36px 24px 60px;
        color: #f59e0b;
        animation: fadeIn 0.3s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      .top-bar {
        width: 100%;
        max-width: 900px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
      }

      .reload-btn {
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(245, 158, 11, 0.5);
        color: #f59e0b;
        font-family: 'Press Start 2P', monospace;
        font-size: 11px;
        padding: 8px 14px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .reload-btn:hover {
        background: #f59e0b;
        color: #000;
        box-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
      }

      .banner-center {
        flex: 1;
        text-align: center;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .banner-title {
        font-size: 16px;
        color: #f59e0b;
        line-height: 1.5;
        text-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
      }

      .banner-sub {
        font-size: 15px;
        color: #fbbf24;
        line-height: 1.5;
        text-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
      }

      .center-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 32px;
        margin-top: auto;
        margin-bottom: auto;
      }

      .sprite-wrapper {
        position: relative;
        width: 140px;
        height: 140px;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: spriteFloat 2.5s ease-in-out infinite alternate;
      }

      @keyframes spriteFloat {
        0%   { transform: translateY(0px); filter: drop-shadow(0 0 14px rgba(245, 158, 11, 0.4)); }
        100% { transform: translateY(-12px); filter: drop-shadow(0 0 28px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 40px rgba(124, 58, 237, 0.5)); }
      }

      .sprite-pixel {
        font-size: 84px;
        line-height: 1;
        user-select: none;
      }

      .pay-btn {
        background: rgba(10, 10, 18, 0.85);
        border: 2px solid #f59e0b;
        color: #f59e0b;
        font-family: 'Press Start 2P', monospace;
        font-size: 15px;
        padding: 16px 36px;
        border-radius: 30px;
        cursor: pointer;
        box-shadow: 0 0 20px rgba(245, 158, 11, 0.5), inset 0 0 10px rgba(245, 158, 11, 0.2);
        transition: all 0.2s ease;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }

      .pay-btn:hover:not(:disabled) {
        background: #f59e0b;
        color: #000;
        box-shadow: 0 0 35px rgba(245, 158, 11, 0.95), 0 0 50px rgba(245, 158, 11, 0.6);
        transform: scale(1.06);
      }

      .pay-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .error-msg {
        font-size: 10px;
        color: #ef4444;
        text-align: center;
        margin-top: 12px;
        text-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
      }

      .shake {
        animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
      }

      @keyframes shake {
        10%, 90% { transform: translate3d(-2px, 0, 0); }
        20%, 80% { transform: translate3d(4px, 0, 0); }
        30%, 50%, 70% { transform: translate3d(-6px, 0, 0); }
        40%, 60% { transform: translate3d(6px, 0, 0); }
      }
    `;

    shadow.appendChild(styleEl);

    // Build DOM structure matching user screenshot
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';

    const costFormatted = Number(unlockCost).toFixed(2);
    const durationFormatted = Number(unlockDuration).toFixed(2);

    backdrop.innerHTML = `
      <div class="top-bar">
        <button class="reload-btn" id="reloadBtn">↻ Reload</button>
        <div class="banner-center">
          <div class="banner-title">You're trying to Access www.${domain}</div>
          <div class="banner-sub">Pay ${costFormatted} Gold to access for ${durationFormatted} Minutes</div>
        </div>
      </div>

      <div class="center-container">
        <div class="sprite-wrapper">
          <span class="sprite-pixel">🧙‍♂️</span>
        </div>
        <button class="pay-btn" id="payBtn">Pay To Pass</button>
        <div class="error-msg" id="errorMsg"></div>
      </div>
    `;

    shadow.appendChild(backdrop);

    // Event handlers inside Shadow DOM
    const reloadBtn = shadow.getElementById('reloadBtn');
    const payBtn = shadow.getElementById('payBtn');
    const errorMsg = shadow.getElementById('errorMsg');

    reloadBtn.addEventListener('click', () => {
      window.location.reload();
    });

    payBtn.addEventListener('click', async () => {
      payBtn.disabled = true;
      payBtn.textContent = 'UNLOCKING...';
      errorMsg.textContent = '';

      try {
        const unlockRes = await browser.runtime.sendMessage({
          type: 'UNLOCK_SITE',
          domain: domain,
        });

        if (unlockRes?.ok) {
          payBtn.textContent = '✓ UNLOCKED';
          setTimeout(() => {
            document.documentElement.style.overflow = '';
            host.remove();
          }, 600);
        } else {
          payBtn.disabled = false;
          payBtn.textContent = 'Pay To Pass';
          payBtn.classList.add('shake');
          setTimeout(() => payBtn.classList.remove('shake'), 400);

          if (unlockRes?.error === 'insufficient_gold') {
            errorMsg.textContent = `Not enough gold! You have ${unlockRes.gold ?? 0} 🪙`;
          } else {
            errorMsg.textContent = 'Unlock failed. Check connection.';
          }
        }
      } catch (err) {
        console.error('[MIND OS] Overlay unlock error:', err);
        payBtn.disabled = false;
        payBtn.textContent = 'Pay To Pass';
        errorMsg.textContent = 'Network error. Try again.';
      }
    });

  } catch (e) {
    console.error('[MIND OS] Content script error:', e);
  }
})();
