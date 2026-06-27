import React, { useEffect, useRef, useCallback, useReducer } from 'react'

// ──────────────────────────────────────────────────────────────
// CONSTANTS & HERO ROSTER
// ──────────────────────────────────────────────────────────────
const TICK_MS = 2200        // base auto-attack interval
const BOSS_TICK_MS = 3500   // boss counter-attack interval
const MAX_FLOATERS = 12     // limit floating numbers

const HERO_ROSTER = [
  { id: 'scholar',  emoji: '🧙',  name: 'Scholar',   color: '#818cf8', borderColor: 'rgba(129,140,248,0.7)',  baseDmg: [18, 32], mana: true,  synergy: 'mage' },
  { id: 'warrior',  emoji: '⚔️',  name: 'Warrior',   color: '#f97316', borderColor: 'rgba(249,115,22,0.7)',   baseDmg: [25, 45], mana: false, synergy: 'fighter' },
  { id: 'rogue',    emoji: '🗡️',  name: 'Rogue',     color: '#34d399', borderColor: 'rgba(52,211,153,0.7)',   baseDmg: [12, 28], mana: false, synergy: 'assassin', critRate: 0.35 },
  { id: 'healer',   emoji: '💚',  name: 'Healer',    color: '#4ade80', borderColor: 'rgba(74,222,128,0.7)',   baseDmg: [8,  15], mana: true,  synergy: 'support', isHealer: true },
  { id: 'psion',    emoji: '🔮',  name: 'Psion',     color: '#c084fc', borderColor: 'rgba(192,132,252,0.7)',  baseDmg: [20, 38], mana: true,  synergy: 'mage' },
]

const BOSS_ROSTER = [
  { id: 'sloth',      emoji: '😴', name: 'Lord Sloth',      hp: 2000, phase2: 1200, dmg: [15, 30] },
  { id: 'procrastia', emoji: '⏳', name: 'Procrastia',      hp: 2500, phase2: 1500, dmg: [20, 40] },
  { id: 'entropy',    emoji: '🌀', name: 'Lord Entropy',    hp: 3000, phase2: 1800, dmg: [25, 45] },
  { id: 'ignorance',  emoji: '💀', name: 'The Unknowing',   hp: 3500, phase2: 2000, dmg: [30, 55] },
]

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const makeParty = () => {
  const shuffled = [...HERO_ROSTER].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3).map(h => ({
    ...h,
    currentHp: 100,
    maxHp: 100,
    mp: h.mana ? 40 : 0,
    maxMp: 100,
    isAttacking: false,
    isHit: false,
  }))
}

const makeBoss = (wave) => {
  const base = BOSS_ROSTER[wave % BOSS_ROSTER.length]
  const scale = 1 + wave * 0.25
  return {
    ...base,
    currentHp: Math.round(base.hp * scale),
    maxHp: Math.round(base.hp * scale),
    phase2Threshold: Math.round(base.phase2 * scale),
    isAttacking: false,
    isHit: false,
    enraged: false,
  }
}

// ──────────────────────────────────────────────────────────────
// STATE REDUCER
// ──────────────────────────────────────────────────────────────
const initialState = {
  party: makeParty(),
  boss: makeBoss(0),
  wave: 1,
  combo: 0,
  xp: 0,
  xpToNext: 10,
  sessionCount: 0,
  floaters: [],
  lastFloaterId: 0,
  phase: 'battle', // 'battle' | 'victory'
}

function reducer(state, action) {
  switch (action.type) {

    case 'HERO_ATTACK': {
      const { heroId, damage, isCrit, isHeal } = action
      let newFloaters = [...state.floaters]
      const id = state.lastFloaterId + 1

      // Add floater
      const floaterX = isHeal
        ? rand(8, 40)
        : rand(50, 75)
      newFloaters.push({
        id,
        x: floaterX,
        y: rand(5, 50),
        text: isCrit ? `⚡${damage}!` : isHeal ? `+${damage}` : `${damage}`,
        type: isCrit ? 'crit' : isHeal ? 'heal' : 'dmg',
      })
      if (newFloaters.length > MAX_FLOATERS) newFloaters = newFloaters.slice(-MAX_FLOATERS)

      if (isHeal) {
        // Heal lowest HP hero
        const lowestIdx = state.party.reduce((minIdx, h, i, arr) =>
          h.currentHp < arr[minIdx].currentHp ? i : minIdx, 0)
        const newParty = state.party.map((h, i) =>
          i === lowestIdx ? { ...h, currentHp: clamp(h.currentHp + damage, 0, h.maxHp) } : h
        )
        return { ...state, party: newParty, floaters: newFloaters, lastFloaterId: id }
      }

      const newBossHp = Math.max(0, state.boss.currentHp - damage)
      const newCombo = state.combo + 1
      const bossEnraged = newBossHp < state.boss.phase2Threshold

      if (newBossHp === 0) {
        const newWave = state.wave + 1
        const xpGained = state.wave * 3
        const newXp = state.xp + xpGained
        const levelUp = newXp >= state.xpToNext
        newFloaters.push({ id: id + 1, x: 40, y: 15, text: `+${xpGained}xp`, type: 'xp' })
        return {
          ...state,
          boss: { ...makeBoss(newWave - 1), isHit: true },
          wave: newWave,
          combo: 0,
          xp: levelUp ? newXp - state.xpToNext : newXp,
          xpToNext: levelUp ? state.xpToNext + 5 : state.xpToNext,
          floaters: newFloaters,
          lastFloaterId: id + 1,
          phase: 'victory',
        }
      }

      return {
        ...state,
        boss: { ...state.boss, currentHp: newBossHp, isHit: true, enraged: bossEnraged },
        combo: newCombo,
        floaters: newFloaters,
        lastFloaterId: id,
      }
    }

    case 'BOSS_ATTACK': {
      const { damage, targetIdx } = action
      const id = state.lastFloaterId + 1
      let newFloaters = [...state.floaters, {
        id,
        x: rand(5, 35),
        y: rand(5, 55),
        text: `-${damage}`,
        type: 'boss-dmg',
      }]
      if (newFloaters.length > MAX_FLOATERS) newFloaters = newFloaters.slice(-MAX_FLOATERS)

      const newParty = state.party.map((h, i) => {
        if (i !== targetIdx) return h
        const newHp = Math.max(0, h.currentHp - damage)
        return { ...h, currentHp: newHp, isHit: true }
      })

      return { ...state, party: newParty, floaters: newFloaters, lastFloaterId: id }
    }

    case 'CLEAR_HERO_ANIM': {
      return {
        ...state,
        party: state.party.map((h, i) =>
          i === action.idx ? { ...h, isAttacking: false, isHit: false } : h
        ),
      }
    }

    case 'CLEAR_BOSS_ANIM': {
      return { ...state, boss: { ...state.boss, isHit: false, isAttacking: false } }
    }

    case 'SET_HERO_ATTACKING': {
      return {
        ...state,
        party: state.party.map((h, i) =>
          i === action.idx ? { ...h, isAttacking: true } : h
        ),
      }
    }

    case 'SET_BOSS_ATTACKING': {
      return { ...state, boss: { ...state.boss, isAttacking: true } }
    }

    case 'REMOVE_FLOATER': {
      return { ...state, floaters: state.floaters.filter(f => f.id !== action.id) }
    }

    case 'END_VICTORY': {
      return { ...state, phase: 'battle' }
    }

    case 'INCREMENT_SESSION': {
      return {
        ...state,
        sessionCount: state.sessionCount + action.count,
        xp: Math.min(state.xp + action.count, state.xpToNext),
      }
    }

    default:
      return state
  }
}

// ──────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────
export default function BattleStrip() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const heroTickRef = useRef(null)
  const bossTickRef = useRef(null)
  const victoryTimerRef = useRef(null)

  // ── Hero auto-attack loop ──
  const runHeroTick = useCallback(() => {
    const aliveHeroes = state.party
      .map((h, i) => ({ ...h, idx: i }))
      .filter(h => h.currentHp > 0)

    if (aliveHeroes.length === 0 || state.boss.currentHp === 0 || state.phase !== 'battle') return

    // Rotate through alive heroes
    const attacker = aliveHeroes[Math.floor(Date.now() / TICK_MS) % aliveHeroes.length]
    const isHeal = attacker.isHealer && state.party.some(h => h.currentHp < h.maxHp * 0.6)
    const isCrit = !isHeal && Math.random() < (attacker.critRate || 0.1)
    const [dMin, dMax] = attacker.baseDmg
    let dmg = rand(dMin, dMax)
    if (isCrit) dmg = Math.round(dmg * 1.8)

    dispatch({ type: 'SET_HERO_ATTACKING', idx: attacker.idx })
    setTimeout(() => dispatch({ type: 'HERO_ATTACK', heroId: attacker.id, damage: dmg, isCrit, isHeal }), 120)
    setTimeout(() => dispatch({ type: 'CLEAR_HERO_ANIM', idx: attacker.idx }), 400)
    setTimeout(() => dispatch({ type: 'CLEAR_BOSS_ANIM' }), 700)
  }, [state.party, state.boss.currentHp, state.phase])

  // ── Boss counter-attack loop ──
  const runBossTick = useCallback(() => {
    if (state.phase !== 'battle') return
    const aliveHeroes = state.party
      .map((h, i) => ({ ...h, idx: i }))
      .filter(h => h.currentHp > 0)

    if (aliveHeroes.length === 0 || state.boss.currentHp === 0) return

    const target = pick(aliveHeroes)
    const [dMin, dMax] = state.boss.dmg
    const dmg = rand(dMin, dMax) + (state.boss.enraged ? rand(5, 15) : 0)

    dispatch({ type: 'SET_BOSS_ATTACKING' })
    setTimeout(() => dispatch({ type: 'BOSS_ATTACK', damage: dmg, targetIdx: target.idx }), 150)
    setTimeout(() => dispatch({ type: 'CLEAR_HERO_ANIM', idx: target.idx }), 500)
    setTimeout(() => dispatch({ type: 'CLEAR_BOSS_ANIM' }), 600)
  }, [state.party, state.boss, state.phase])

  // ── Start / restart auto-attack loops ──
  useEffect(() => {
    if (state.phase !== 'battle') return
    heroTickRef.current = setInterval(runHeroTick, TICK_MS)
    bossTickRef.current = setInterval(runBossTick, BOSS_TICK_MS)
    return () => {
      clearInterval(heroTickRef.current)
      clearInterval(bossTickRef.current)
    }
  }, [runHeroTick, runBossTick, state.phase])

  // ── Victory transition ──
  useEffect(() => {
    if (state.phase !== 'victory') return
    victoryTimerRef.current = setTimeout(() => dispatch({ type: 'END_VICTORY' }), 2200)
    return () => clearTimeout(victoryTimerRef.current)
  }, [state.phase])

  // ── Tauri event listener: increment session from main window ──
  useEffect(() => {
    let unlisten = null
    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')
        unlisten = await listen('mindos-action', (event) => {
          const { type, payload } = event.payload || {}
          if (type === 'session-complete') {
            dispatch({ type: 'INCREMENT_SESSION', count: payload?.count || 1 })
          }
        })
      } catch {
        // Running in browser without Tauri — ignore
      }
    }
    setupListener()
    return () => { if (unlisten) unlisten() }
  }, [])

  const { party, boss, wave, combo, xp, xpToNext, sessionCount, floaters, phase } = state
  const bossHpPct = (boss.currentHp / boss.maxHp) * 100
  const xpPct = (xp / xpToNext) * 100

  return (
    <div className="strip">
      {/* Floating damage numbers layer */}
      <div className="floaters-layer">
        {floaters.map(f => (
          <Floater key={f.id} floater={f} onDone={() => dispatch({ type: 'REMOVE_FLOATER', id: f.id })} />
        ))}
      </div>

      {/* Hero party */}
      <div className="heroes">
        {party.map((hero, i) => (
          <HeroSlot key={hero.id} hero={hero} />
        ))}
      </div>

      {/* VS / combo */}
      <div className="vs-divider">
        <span className="vs-text">VS</span>
        {combo > 1 && (
          <span className="combo-counter">{combo}×</span>
        )}
      </div>

      {/* Boss section */}
      <div className="boss-section">
        <div className="boss-header">
          <span className="boss-name">{boss.name}</span>
          <span className="boss-hp-text">{boss.currentHp}/{boss.maxHp}</span>
        </div>
        <div className="boss-hp-bar">
          <div
            className={`boss-hp-fill${boss.enraged ? ' enraged' : ''}`}
            style={{ width: `${bossHpPct}%` }}
          />
        </div>
      </div>

      {/* Boss avatar */}
      <div className={`boss-avatar${boss.isAttacking ? ' boss-attack' : ''}${boss.isHit ? ' boss-hit' : ''}`}>
        {phase === 'victory' ? '✨' : boss.emoji}
      </div>

      {/* Right panel */}
      <div className="right-panel">
        <span className="wave-badge">W{wave}</span>
        <div className="xp-bar-wrap">
          <span className="xp-label">XP</span>
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: `${xpPct}%` }} />
          </div>
        </div>
        {sessionCount > 0 && (
          <span className="session-count">{sessionCount} sessions</span>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────
function HeroSlot({ hero }) {
  const hpPct = (hero.currentHp / hero.maxHp) * 100
  const isLow = hpPct < 30

  return (
    <div className="hero-slot">
      <div
        className={`hero-avatar${hero.isAttacking ? ' attacking' : ''}${hero.isHit ? ' hit' : ''}`}
        style={{
          background: `${hero.color}18`,
          borderColor: hero.currentHp > 0 ? hero.borderColor : 'rgba(255,255,255,0.1)',
          opacity: hero.currentHp === 0 ? 0.35 : 1,
        }}
        title={hero.name}
      >
        {hero.emoji}
      </div>
      <div className="hero-hp-bar">
        <div
          className={`hero-hp-fill${isLow ? ' low' : ''}`}
          style={{ width: `${hpPct}%` }}
        />
      </div>
    </div>
  )
}

function Floater({ floater, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 900)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <span
      className={`floater ${floater.type}`}
      style={{ left: `${floater.x}%`, top: `${floater.y}%` }}
    >
      {floater.text}
    </span>
  )
}
