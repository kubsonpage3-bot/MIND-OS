import HabitsColumn from "./HabitsColumn";
import DailiesColumn from "./DailiesColumn";
import TodosColumn from "./TodosColumn";

export default function TasksPanel({ onXpGain, onBossDamage, onRankXP, subTab, onRewardFly }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <HabitsColumn onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} />
      <DailiesColumn onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} />
      <TodosColumn onXpGain={onXpGain} onBossDamage={onBossDamage} onRankXP={onRankXP} />
    </div>
  );
}