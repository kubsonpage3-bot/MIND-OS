import { useReducer, useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Swords, Shield, Settings2, ChevronRight, Star, Zap, SkipForward } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────
const HEROES = [
  { id: 'scholar',  emoji: '🧙', name: 'Scholar',  color: '#818cf8', baseDmg: [18, 32], critRate: 0.12, role: 'Mage',    desc: 'High magic dmg' },
  { id: 'warrior',  emoji: '⚔️', name: 'Warrior',  color: '#f97316', baseDmg: [28, 48], critRate: 0.08, role: 'Fighter', desc: 'Heavy melee dmg' },
  { id: 'rogue',    emoji: '🗡️', name: 'Rogue',    color: '#34d399', baseDmg: [14, 26], critRate: 0.38, role: 'Assassin', desc: 'High crit rate' },
  { id: 'healer',   emoji: '💚', name: 'Healer',   color: '#4ade80', baseDmg: [8,  14], critRate: 0.05, role: 'Support', desc: 'Heals allies', isHealer: true },
  { id: 'psion',    emoji: '🔮', name: 'Psion',    color: '#c084fc', baseDmg: [22, 40], critRate: 0.15, role: 'Mage',    desc: 'AoE burst dmg' },
]

const DUNGEONS = [
  {
    id: 'forest',
    name: '🌲 Enchanted Forest',
    shortName: 'Forest',
    bg: 'linear-gradient(135deg, #052e16 0%, #14532d 40%, #166534 70%, #052e16 100%)',
    accent: '#4ade80',
    bosses: [
      { name: 'Lord Sloth',    emoji: '😴', hp: 1800, dmg: [12, 22], enrageAt: 0.35 },
      { name: 'Vine Tyrant',   emoji: '🌿', hp: 2400, dmg: [15, 28], enrageAt: 0.30 },
    ],
  },
  {
    id: 'volcano',
    name: '🌋 Infernal Volcano',
    shortName: 'Volcano',
    bg: 'linear-gradient(135deg, #431407 0%, #7c2d12 40%, #dc2626 70%, #431407 100%)',
    accent: '#f97316',
    bosses: [
      { name: 'Procrastia',    emoji: '⏳', hp: 2200, dmg: [18, 34], enrageAt: 0.40 },
      { name: 'Lava Drake',    emoji: '🐉', hp: 3000, dmg: [22, 42], enrageAt: 0.35 },
    ],
  },
  {
    id: 'void',
    name: '🌌 Void Realm',
    shortName: 'Void',
    bg: 'linear-gradient(135deg, #0f0a1e 0%, #1e1035 40%, #2d1b69 70%, #0f0a1e 100%)',
    accent: '#a78bfa',
    bosses: [
      { name: 'Lord Entropy',  emoji: '🌀', hp: 2800, dmg: [20, 38], enrageAt: 0.30 },
      { name: 'The Unknowing', emoji: '💀', hp: 3500, dmg: [25, 48], enrageAt: 0.25 },
    ],
  },
  {
    id: 'ice',
    name: '🏔️ Frozen Peak',
    shortName: 'Ice Peak',
    bg: 'linear-gradient(135deg, #0c4a6e 0%, #0e7490 40%, #164e63 70%, #0c4a6e 100%)',
    accent: '#38bdf8',
    bosses: [
      { name: 'Glacius Rex',   emoji: '🧊', hp: 2600, dmg: [16, 32], enrageAt: 0.35 },
      { name: 'Blizzard King', emoji: '❄️', hp: 3200, dmg: [20, 40], enrageAt: 0.30 },
    ],
  },
  {
    id: 'shadow',
    name: '💀 Shadow Realm',
    shortName: 'Shadow',
    bg: 'linear-gradient(135deg, #030712 0%, #111827 40%, #1f2937 70%, #030712 100%)',
    accent: '#f43f5e',
    bosses: [
      { name: 'Nightmare',     emoji: '👁️', hp: 4000, dmg: [28, 55], enrageAt: 0.25 },
      { name: 'Void Wraith',   emoji: '👻', hp: 5000, dmg: [35, 65], enrageAt: 0.20 },
    ],
  },
]

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const makeParty = (heroIds) =>
  heroIds.map(id => {
    const h = HEROES.find(h => h.id === id)
    return { ...h, currentHp: 100, maxHp: 100 }
  })

const makeBoss = (dungeon, waveInDungeon) => {
  const bossTemplate = dungeon.bosses[waveInDungeon % dungeon.bosses.length]
  return { ...bossTemplate, currentHp: bossTemplate.hp, maxHp: bossTemplate.hp, enraged: false }
}

// ─────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────
const MAX_FLOATERS = 14

function battleReducer(state, action) {
  switch (action.type) {
    case 'RESET': {
      return {
        ...state,
        party: makeParty(action.heroIds),
        boss: makeBoss(action.dungeon, 0),
        wave: 1,
        combo: 0,
        xp: 0,
        xpToNext: 10,
        floaters: [],
        nextFloaterId: 0,
        phase: 'battle',
        totalDmgDealt: 0,
      }
    }

    case 'HERO_ATTACK': {
      const { damage, isCrit, isHeal, heroIdx } = action
      const id = state.nextFloaterId + 1
      const newFloaters = [
        ...state.floaters.slice(-MAX_FLOATERS + 1),
        {
          id,
          x: isHeal ? rand(10, 35) : rand(52, 78),
          y: rand(8, 55),
          text: isCrit ? `⚡${damage}!` : isHeal ? `+${damage}` : `${damage}`,
          type: isCrit ? 'crit' : isHeal ? 'heal' : 'dmg',
        }
      ]

      if (isHeal) {
        const lowestIdx = state.party.reduce((mi, h, i, a) => h.currentHp < a[mi].currentHp ? i : mi, 0)
        const party = state.party.map((h, i) =>
          i === lowestIdx ? { ...h, currentHp: clamp(h.currentHp + damage, 0, h.maxHp) } : h
        )
        return { ...state, party, floaters: newFloaters, nextFloaterId: id }
      }

      const bonusMult = action.bonusMult || 1
      const finalDmg = Math.round(damage * bonusMult)
      const newBossHp = Math.max(0, state.boss.currentHp - finalDmg)
      const enraged = newBossHp < state.boss.maxHp * state.boss.enrageAt

      if (newBossHp === 0) {
        const xpGain = state.wave * 5
        const newXp = state.xp + xpGain
        const levelUp = newXp >= state.xpToNext
        const extraFloater = { id: id + 1, x: 45, y: 20, text: `+${xpGain}xp`, type: 'xp' }
        return {
          ...state,
          boss: { ...state.boss, currentHp: 0 },
          wave: state.wave + 1,
          combo: 0,
          xp: levelUp ? newXp - state.xpToNext : newXp,
          xpToNext: levelUp ? state.xpToNext + 5 : state.xpToNext,
          floaters: [...newFloaters, extraFloater],
          nextFloaterId: id + 1,
          phase: 'victory',
          totalDmgDealt: state.totalDmgDealt + finalDmg,
        }
      }

      return {
        ...state,
        boss: { ...state.boss, currentHp: newBossHp, enraged },
        combo: state.combo + 1,
        floaters: newFloaters,
        nextFloaterId: id,
        totalDmgDealt: state.totalDmgDealt + finalDmg,
      }
    }

    case 'BOSS_ATTACK': {
      const { damage, targetIdx } = action
      const id = state.nextFloaterId + 1
      const newFloaters = [
        ...state.floaters.slice(-MAX_FLOATERS + 1),
        { id, x: rand(8, 38), y: rand(10, 60), text: `-${damage}`, type: 'boss-dmg' }
      ]
      const party = state.party.map((h, i) =>
        i === targetIdx ? { ...h, currentHp: Math.max(0, h.currentHp - damage) } : h
      )
      return { ...state, party, floaters: newFloaters, nextFloaterId: id }
    }

    case 'NEXT_WAVE': {
      const dungeon = action.dungeon
      return {
        ...state,
        boss: makeBoss(dungeon, state.wave),
        phase: 'battle',
        combo: 0,
      }
    }

    case 'REMOVE_FLOATER':
      return { ...state, floaters: state.floaters.filter(f => f.id !== action.id) }

    case 'BONUS_DAMAGE': {
      const id = state.nextFloaterId + 1
      const dmg = action.amount
      const newBossHp = Math.max(0, state.boss.currentHp - dmg)
      const enraged = newBossHp < state.boss.maxHp * state.boss.enrageAt
      const newFloaters = [
        ...state.floaters.slice(-MAX_FLOATERS + 1),
        { id, x: rand(50, 75), y: rand(5, 30), text: `⚡${dmg} TASK!`, type: 'crit' }
      ]
      if (newBossHp === 0) {
        return { ...state, boss: { ...state.boss, currentHp: 0 }, floaters: newFloaters, nextFloaterId: id, wave: state.wave + 1, phase: 'victory' }
      }
      return { ...state, boss: { ...state.boss, currentHp: newBossHp, enraged }, floaters: newFloaters, nextFloaterId: id }
    }

    default:
      return state
  }
}

const DEFAULT_PARTY = ['warrior', 'scholar', 'rogue']

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function BattleArena() {
  const [activeDungeonId, setActiveDungeonId] = useState('forest')
  const [selectedParty, setSelectedParty] = useState(DEFAULT_PARTY)
  const [view, setView] = useState('battle') // 'battle' | 'setup' | 'dungeons'
  const [bonusMult, setBonusMult] = useState(1)
  const bonusMultRef = useRef(1)

  const dungeon = DUNGEONS.find(d => d.id === activeDungeonId)

  const [state, dispatch] = useReducer(battleReducer, null, () => ({
    party: makeParty(DEFAULT_PARTY),
    boss: makeBoss(dungeon, 0),
    wave: 1,
    combo: 0,
    xp: 0,
    xpToNext: 10,
    floaters: [],
    nextFloaterId: 0,
    phase: 'battle',
    totalDmgDealt: 0,
  }))

  const heroTickRef = useRef(null)
  const bossTickRef = useRef(null)
  const heroIdxRef = useRef(0)

  // Listen for Task completion bonuses via CustomEvent
  useEffect(() => {
    const handler = (e) => {
      const mult = e.detail?.mult || 2.5
      bonusMultRef.current = mult
      setBonusMult(mult)
      // Auto-reset bonus after 8s
      setTimeout(() => { bonusMultRef.current = 1; setBonusMult(1) }, 8000)
    }
    window.addEventListener('mindos:dungeon-hit', handler)
    return () => window.removeEventListener('mindos:dungeon-hit', handler)
  }, [])

  // Hero auto-attack loop
  const runHeroTick = useCallback(() => {
    const aliveHeroes = state.party.map((h, i) => ({ ...h, idx: i })).filter(h => h.currentHp > 0)
    if (!aliveHeroes.length || state.boss.currentHp === 0 || state.phase !== 'battle') return
    const attacker = aliveHeroes[heroIdxRef.current % aliveHeroes.length]
    heroIdxRef.current++
    const isHeal = !!attacker.isHealer && state.party.some(h => h.currentHp < h.maxHp * 0.55)
    const isCrit = !isHeal && Math.random() < (attacker.critRate || 0.1)
    const [dMin, dMax] = attacker.baseDmg
    let dmg = rand(dMin, dMax)
    if (isCrit) dmg = Math.round(dmg * 1.9)
    dispatch({ type: 'HERO_ATTACK', damage: dmg, isCrit, isHeal, heroIdx: attacker.idx, bonusMult: bonusMultRef.current })
  }, [state.party, state.boss.currentHp, state.phase])

  // Boss counter-attack loop
  const runBossTick = useCallback(() => {
    if (state.phase !== 'battle' || state.boss.currentHp === 0) return
    const aliveHeroes = state.party.map((h, i) => ({ ...h, idx: i })).filter(h => h.currentHp > 0)
    if (!aliveHeroes.length) return
    const target = pick(aliveHeroes)
    const [dMin, dMax] = state.boss.dmg
    const dmg = rand(dMin, dMax) + (state.boss.enraged ? rand(8, 18) : 0)
    dispatch({ type: 'BOSS_ATTACK', damage: dmg, targetIdx: target.idx })
  }, [state.party, state.boss, state.phase])

  useEffect(() => {
    if (state.phase !== 'battle') return
    heroTickRef.current = setInterval(runHeroTick, 1800)
    bossTickRef.current = setInterval(runBossTick, 3200)
    return () => { clearInterval(heroTickRef.current); clearInterval(bossTickRef.current) }
  }, [runHeroTick, runBossTick, state.phase])

  // Victory → next wave after delay
  useEffect(() => {
    if (state.phase !== 'victory') return
    const t = setTimeout(() => dispatch({ type: 'NEXT_WAVE', dungeon }), 2000)
    return () => clearTimeout(t)
  }, [state.phase, dungeon])

  const handleChangeDungeon = (dungeonId) => {
    setActiveDungeonId(dungeonId)
    const d = DUNGEONS.find(x => x.id === dungeonId)
    dispatch({ type: 'RESET', heroIds: selectedParty, dungeon: d })
    setView('battle')
  }

  const handleSaveParty = (newParty) => {
    setSelectedParty(newParty)
    dispatch({ type: 'RESET', heroIds: newParty, dungeon })
    setView('battle')
  }

  const bossHpPct = (state.boss.currentHp / state.boss.maxHp) * 100
  const xpPct = (state.xp / state.xpToNext) * 100
  const bonusActive = bonusMult > 1

  return (
    <div className='w-full max-w-2xl mx-auto'>
      {/* Header */}
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Swords className='w-5 h-5' style={{ color: dungeon.accent }} />
          <span className='font-black text-base tracking-wide' style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--habit-text)' }}>
            DUNGEON
          </span>
          <span className='text-xs font-semibold px-2 py-0.5 rounded-full' style={{ background: `${dungeon.accent}22`, color: dungeon.accent }}>
            Wave {state.wave}
          </span>
          {bonusActive && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className='text-xs font-black px-2 py-0.5 rounded-full flex items-center gap-1'
              style={{ background: '#fbbf2422', color: '#fbbf24', border: '1px solid #fbbf2444' }}
            >
              <Zap className='w-3 h-3' />×{bonusMult} TASK BONUS
            </motion.span>
          )}
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => setView(view === 'dungeons' ? 'battle' : 'dungeons')}
            className='p-1.5 rounded-lg transition-all text-xs font-bold flex items-center gap-1'
            style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)', color: 'var(--habit-dim)' }}
          >
            🗺️ {dungeon.shortName}
          </button>
          <button
            onClick={() => setView(view === 'setup' ? 'battle' : 'setup')}
            className='p-1.5 rounded-lg transition-all'
            style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)', color: 'var(--habit-dim)' }}
          >
            <Settings2 className='w-4 h-4' />
          </button>
        </div>
      </div>

      {/* Dungeon Selector Panel */}
      <AnimatePresence>
        {view === 'dungeons' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className='overflow-hidden mb-3'
          >
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-xl' style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}>
              {DUNGEONS.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleChangeDungeon(d.id)}
                  className='relative flex flex-col items-start gap-1 p-3 rounded-xl text-left transition-all hover:scale-[1.02]'
                  style={{
                    background: d.bg,
                    border: activeDungeonId === d.id ? `2px solid ${d.accent}` : '2px solid transparent',
                    boxShadow: activeDungeonId === d.id ? `0 0 12px ${d.accent}55` : 'none',
                  }}
                >
                  <span className='text-xl'>{d.bosses[0].emoji}</span>
                  <span className='text-xs font-black text-white leading-tight' style={{ fontFamily: "'Nunito', sans-serif" }}>{d.name}</span>
                  <span className='text-[10px] font-semibold' style={{ color: d.accent }}>{d.bosses.length} bosses</span>
                  {activeDungeonId === d.id && (
                    <span className='absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full' style={{ background: d.accent, color: '#000' }}>ACTIVE</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Party Setup Panel */}
      <AnimatePresence>
        {view === 'setup' && (
          <PartySetup
            selectedParty={selectedParty}
            onSave={handleSaveParty}
            onCancel={() => setView('battle')}
          />
        )}
      </AnimatePresence>

      {/* Battle Arena */}
      {view === 'battle' && (
        <div
          className='relative rounded-2xl overflow-hidden'
          style={{ background: dungeon.bg, border: `1px solid ${dungeon.accent}44`, minHeight: 260 }}
        >
          {/* Floating damage numbers */}
          <div className='absolute inset-0 pointer-events-none overflow-hidden z-20'>
            <AnimatePresence>
              {state.floaters.map(f => (
                <FloatNumber key={f.id} floater={f} onDone={() => dispatch({ type: 'REMOVE_FLOATER', id: f.id })} />
              ))}
            </AnimatePresence>
          </div>

          {/* Victory overlay */}
          <AnimatePresence>
            {state.phase === 'victory' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className='absolute inset-0 flex flex-col items-center justify-center z-30'
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              >
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className='text-center'
                >
                  <div className='text-5xl mb-2'>🏆</div>
                  <div className='font-black text-2xl text-white mb-1' style={{ fontFamily: "'Nunito', sans-serif" }}>DEFEATED!</div>
                  <div className='text-sm font-bold mb-3' style={{ color: dungeon.accent }}>Wave {state.wave - 1} cleared</div>
                  <div className='flex gap-2 justify-center text-xs font-bold text-white/70'>
                    <span>+{(state.wave - 1) * 5}xp</span>
                    <span>·</span>
                    <span>Wave {state.wave} incoming…</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className='relative z-10 p-4 flex gap-4 items-stretch' style={{ minHeight: 260 }}>
            {/* LEFT: Party */}
            <div className='flex flex-col gap-2 justify-center' style={{ minWidth: 90 }}>
              <div className='text-[9px] font-black tracking-widest mb-1 text-white/40 uppercase'>Party</div>
              {state.party.map((hero, i) => (
                <HeroCard key={hero.id} hero={hero} accent={dungeon.accent} />
              ))}
            </div>

            {/* CENTER: VS + Boss HP + Boss */}
            <div className='flex-1 flex flex-col justify-between gap-2'>
              {/* Boss HP bar */}
              <div>
                <div className='flex justify-between text-[10px] font-bold mb-1'>
                  <span className='text-white/60'>{state.boss.name}</span>
                  <span style={{ color: dungeon.accent }}>{state.boss.currentHp}/{state.boss.maxHp}</span>
                </div>
                <div className='h-2.5 rounded-full overflow-hidden' style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className='h-full rounded-full'
                    style={{ background: state.boss.enraged ? `linear-gradient(90deg, #7f1d1d, ${dungeon.accent})` : `linear-gradient(90deg, #991b1b, ${dungeon.accent})` }}
                    animate={{ width: `${bossHpPct}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                {state.boss.enraged && (
                  <motion.div
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className='text-[9px] font-black mt-0.5'
                    style={{ color: '#ef4444' }}
                  >⚠ ENRAGED</motion.div>
                )}
              </div>

              {/* Boss avatar */}
              <motion.div
                className='flex-1 flex items-center justify-center'
                animate={state.phase === 'victory' ? { scale: 0.8, opacity: 0.5 } : {}}
              >
                <motion.div
                  className='text-7xl select-none'
                  animate={state.boss.enraged ? { rotate: [-3, 3, -3], scale: [1, 1.05, 1] } : {}}
                  transition={state.boss.enraged ? { duration: 0.4, repeat: Infinity } : {}}
                  style={{ filter: `drop-shadow(0 0 20px ${dungeon.accent}88)` }}
                >
                  {state.boss.emoji}
                </motion.div>
              </motion.div>

              {/* XP + stats bar */}
              <div className='flex items-center gap-3 text-[10px]'>
                <div className='flex-1'>
                  <div className='text-white/40 mb-0.5 text-[9px] uppercase tracking-wider'>XP</div>
                  <div className='h-1.5 rounded-full overflow-hidden' style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <motion.div
                      className='h-full rounded-full'
                      style={{ background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }}
                      animate={{ width: `${xpPct}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
                {state.combo > 2 && (
                  <span className='font-black text-[11px]' style={{ color: '#fbbf24', textShadow: '0 0 8px #fbbf2488' }}>
                    {state.combo}× combo
                  </span>
                )}
                <span className='text-white/30'>{state.totalDmgDealt.toLocaleString()} total</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task bonus hint */}
      <div className='mt-2 text-center text-[10px] font-semibold' style={{ color: 'var(--habit-dim)' }}>
        ⚔️ Complete Tasks &amp; Dailies for ×2.5 bonus damage bursts
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HERO CARD
// ─────────────────────────────────────────────────────────────
function HeroCard({ hero, accent }) {
  const hpPct = (hero.currentHp / hero.maxHp) * 100
  const isLow = hpPct < 30
  const isDead = hero.currentHp === 0

  return (
    <div
      className='flex items-center gap-2 px-2 py-1.5 rounded-xl transition-opacity'
      style={{
        background: `${hero.color}18`,
        border: `1px solid ${hero.color}44`,
        opacity: isDead ? 0.35 : 1,
      }}
    >
      <span className='text-lg leading-none'>{hero.emoji}</span>
      <div className='flex-1 min-w-0'>
        <div className='text-[9px] font-bold text-white/70 truncate'>{hero.name}</div>
        <div className='h-1.5 rounded-full overflow-hidden mt-0.5' style={{ background: 'rgba(255,255,255,0.1)' }}>
          <motion.div
            className='h-full rounded-full'
            style={{ background: isLow ? '#f97316' : '#22c55e' }}
            animate={{ width: `${hpPct}%` }}
            transition={{ duration: 0.35 }}
          />
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FLOATER
// ─────────────────────────────────────────────────────────────
const FLOATER_STYLES = {
  dmg:      { color: '#ff6b35', size: 13 },
  heal:     { color: '#4ade80', size: 13 },
  crit:     { color: '#fbbf24', size: 17 },
  'boss-dmg': { color: '#f87171', size: 13 },
  xp:       { color: '#a78bfa', size: 10 },
}

function FloatNumber({ floater, onDone }) {
  const style = FLOATER_STYLES[floater.type] || FLOATER_STYLES.dmg
  return (
    <motion.span
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -42, scale: floater.type === 'crit' ? 1.2 : 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      onAnimationComplete={onDone}
      className='absolute font-black pointer-events-none whitespace-nowrap'
      style={{
        left: `${floater.x}%`,
        top: `${floater.y}%`,
        color: style.color,
        fontSize: style.size,
        textShadow: `0 2px 8px rgba(0,0,0,0.8)`,
        zIndex: 20,
        fontFamily: "'Nunito', sans-serif",
      }}
    >
      {floater.text}
    </motion.span>
  )
}

// ─────────────────────────────────────────────────────────────
// PARTY SETUP PANEL
// ─────────────────────────────────────────────────────────────
function PartySetup({ selectedParty, onSave, onCancel }) {
  const [draft, setDraft] = useState([...selectedParty])

  const toggle = (heroId) => {
    if (draft.includes(heroId)) {
      if (draft.length <= 1) return // keep at least 1
      setDraft(draft.filter(id => id !== heroId))
    } else {
      if (draft.length >= 3) {
        setDraft([...draft.slice(1), heroId]) // replace oldest
      } else {
        setDraft([...draft, heroId])
      }
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className='overflow-hidden mb-3'
    >
      <div className='p-4 rounded-xl' style={{ background: 'var(--habit-panel)', border: '1px solid var(--habit-border)' }}>
        <div className='flex items-center justify-between mb-3'>
          <div>
            <div className='font-black text-sm' style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--habit-text)' }}>⚔️ Party Setup</div>
            <div className='text-[11px]' style={{ color: 'var(--habit-dim)' }}>Select up to 3 heroes</div>
          </div>
          <div className='flex gap-2'>
            <button
              onClick={onCancel}
              className='text-xs px-3 py-1.5 rounded-lg font-bold'
              style={{ background: 'var(--habit-border)', color: 'var(--habit-dim)' }}
            >Cancel</button>
            <button
              onClick={() => onSave(draft)}
              className='text-xs px-3 py-1.5 rounded-lg font-black text-white'
              style={{ background: 'var(--habit-purple)' }}
            >Save Party</button>
          </div>
        </div>

        {/* Current party preview */}
        <div className='flex gap-2 mb-3 p-2 rounded-lg' style={{ background: 'rgba(123,97,255,0.08)' }}>
          {[0, 1, 2].map(i => {
            const hero = HEROES.find(h => h.id === draft[i])
            return (
              <div key={i} className='flex-1 flex flex-col items-center gap-1 p-2 rounded-lg' style={{ background: hero ? `${hero.color}18` : 'var(--habit-border)', border: `1px solid ${hero ? hero.color + '44' : 'var(--habit-border)'}`, minHeight: 56 }}>
                {hero ? (
                  <>
                    <span className='text-2xl'>{hero.emoji}</span>
                    <span className='text-[9px] font-bold text-center' style={{ color: hero.color }}>{hero.name}</span>
                  </>
                ) : (
                  <span className='text-white/20 text-xl mt-1'>+</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Hero roster */}
        <div className='grid grid-cols-1 gap-2'>
          {HEROES.map(hero => {
            const isSelected = draft.includes(hero.id)
            const slotIdx = draft.indexOf(hero.id)
            return (
              <button
                key={hero.id}
                onClick={() => toggle(hero.id)}
                className='flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01]'
                style={{
                  background: isSelected ? `${hero.color}18` : 'var(--habit-bg)',
                  border: `2px solid ${isSelected ? hero.color : 'var(--habit-border)'}`,
                  boxShadow: isSelected ? `0 0 10px ${hero.color}33` : 'none',
                }}
              >
                <span className='text-2xl'>{hero.emoji}</span>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='font-black text-sm' style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--habit-text)' }}>{hero.name}</span>
                    <span className='text-[10px] font-bold px-1.5 py-0.5 rounded-full' style={{ background: `${hero.color}22`, color: hero.color }}>{hero.role}</span>
                  </div>
                  <div className='text-[11px] mt-0.5' style={{ color: 'var(--habit-dim)' }}>{hero.desc} · Crit: {Math.round(hero.critRate * 100)}%</div>
                </div>
                {isSelected && (
                  <div className='w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white' style={{ background: hero.color }}>
                    {slotIdx + 1}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
