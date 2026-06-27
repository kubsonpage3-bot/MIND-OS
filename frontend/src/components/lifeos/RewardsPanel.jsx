import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export default function RewardsPanel({ gs, update }) {
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCost, setNewCost] = useState(30);
  const [newIcon, setNewIcon] = useState("🎁");
  const [msg, setMsg] = useState(null);

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(null), 2500);
  };

  const buyReward = (reward) => {
    if (gs.gold < reward.cost) { flash("Not enough gold!"); return; }

    update(s => {
      let ns = { ...s, gold: s.gold - reward.cost };

      if (reward.id === "potion") {
        ns = { ...ns, hp: Math.min(ns.maxHp, ns.hp + 15),
          logs: [{ type: "reward", msg: "🧪 Used Health Potion (+15 HP)", ts: Date.now() }, ...ns.logs].slice(0, 50) };
      } else if (reward.id === "skip") {
        // Mark one incomplete daily as done without reward
        const target = ns.dailies.find(d => !d.completedToday);
        if (target) {
          ns = { ...ns,
            dailies: ns.dailies.map(d => d.id === target.id ? { ...d, completedToday: true } : d),
            logs: [{ type: "reward", msg: `🛡️ Skipped daily: ${target.label}`, ts: Date.now() }, ...ns.logs].slice(0, 50) };
        }
      } else {
        ns = { ...ns, logs: [{ type: "reward", msg: `🎁 Redeemed: ${reward.label}`, ts: Date.now() }, ...ns.logs].slice(0, 50) };
      }

      return ns;
    });
    flash(`Redeemed: ${reward.label}!`);
  };

  const addReward = () => {
    if (!newLabel.trim()) return;
    const reward = { id: Date.now().toString(), label: newLabel.trim(), cost: newCost, icon: newIcon, builtIn: false };
    update(s => ({ ...s, rewards: [...s.rewards, reward] }));
    setNewLabel("");
    setNewCost(30);
    setAdding(false);
  };

  const deleteReward = (id) => {
    update(s => ({ ...s, rewards: s.rewards.filter(r => r.id !== id) }));
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {msg && (
        <div className="text-center text-sm py-2 px-4 rounded-lg bg-purple-800/40 border border-purple-600/40 text-purple-200">
          {msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-purple-200 font-bold text-sm uppercase tracking-wider">🎁 Rewards</h2>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-sm font-bold">🪙 {gs.gold} gold</span>
          <button onClick={() => setAdding(v => !v)} className="text-purple-400 hover:text-purple-200">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {adding && (
        <div className="p-4 rounded-xl border border-purple-600/50 bg-purple-900/40 space-y-3">
          <div className="flex gap-2">
            <input value={newIcon} onChange={e => setNewIcon(e.target.value)}
              className="w-12 bg-purple-900/40 border border-purple-700/40 rounded px-2 py-2 text-center text-sm focus:outline-none"
              placeholder="🎁" />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              placeholder="Reward name..."
              className="flex-1 bg-purple-900/40 border border-purple-700/40 rounded px-3 py-2 text-sm text-white placeholder-purple-600 focus:outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-400">Cost (gold):</span>
            <input type="number" value={newCost} onChange={e => setNewCost(Number(e.target.value))} min={1}
              className="w-20 bg-purple-900/40 border border-purple-700/40 rounded px-2 py-1 text-xs text-white focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={addReward} className="flex-1 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold">Add Reward</button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 rounded border border-purple-700/40 text-purple-500 text-xs">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {gs.rewards.map(reward => {
          const canAfford = gs.gold >= reward.cost;
          return (
            <div key={reward.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
              canAfford ? "border-purple-700/50 bg-purple-900/30 hover:bg-purple-800/30" : "border-purple-900/30 bg-purple-950/20 opacity-60"
            }`}>
              <span className="text-2xl shrink-0">{reward.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-purple-100">{reward.label}</div>
                <div className="text-xs text-yellow-400 font-bold mt-0.5">🪙 {reward.cost} gold</div>
              </div>
              <button
                onClick={() => buyReward(reward)}
                disabled={!canAfford}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-all bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:text-purple-700 text-white"
              >
                Buy
              </button>
              {!reward.builtIn && (
                <button onClick={() => deleteReward(reward.id)} className="text-purple-700 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}