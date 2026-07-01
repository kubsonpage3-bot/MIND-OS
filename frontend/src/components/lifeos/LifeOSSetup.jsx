import { useState } from "react";
import { Sparkles } from "lucide-react";

const AVATARS = ["🧙", "⚔️", "🏹", "🛡️", "🔮", "🐉", "🦊", "🐺"];

export default function LifeOSSetup({ onComplete }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🧙");

  return (
    <div className="min-h-screen bg-[#1a0a2e] flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-white font-mono">
        <div className="text-center">
          <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-purple-200 tracking-wider">LIFE OS</h1>
          <p className="text-purple-500 text-sm mt-1">Your RPG Habit Tracker</p>
        </div>

        <div className="p-6 rounded-xl border border-purple-700/40 bg-purple-950/50 space-y-5">
          <div>
            <label className="block text-xs text-purple-400 uppercase tracking-wider mb-2">Your Hero Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name..."
              className="w-full bg-purple-900/40 border border-purple-700/50 rounded-lg px-4 py-2.5 text-sm text-white placeholder-purple-600 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs text-purple-400 uppercase tracking-wider mb-2">Choose Avatar</label>
            <div className="grid grid-cols-4 gap-2">
              {AVATARS.map(av => (
                <button
                  key={av}
                  onClick={() => setAvatar(av)}
                  className={`text-2xl py-2 rounded-lg border transition-all ${
                    avatar === av
                      ? "border-purple-400 bg-purple-700/50"
                      : "border-purple-800/40 bg-purple-900/20 hover:bg-purple-800/30"
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => { if (name.trim()) onComplete({ name: name.trim(), avatar }); }}
            disabled={!name.trim()}
            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-all tracking-wider"
          >
            BEGIN YOUR QUEST ⚔️
          </button>
        </div>

        <p className="text-center text-xs text-purple-600">
          Complete habits, dailies, and to-dos to level up!
        </p>
      </div>
    </div>
  );
}