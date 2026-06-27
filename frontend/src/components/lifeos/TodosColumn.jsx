import { useState } from "react";
import { gainXP, gainGold, getDifficulty, maybeDropItem } from "@/lib/lifeOS";
import { CheckSquare, Square, Trash2, PlusCircle, ChevronDown, ChevronUp, Plus } from "lucide-react";
import TaskForm from "./TaskForm";

export default function TodosColumn({ gs, update }) {
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState({});

  const complete = (todo) => {
    if (todo.done) return;
    const diff = getDifficulty(todo.difficulty);
    update(s => {
      let ns = gainXP(s, diff.xp);
      ns = gainGold(ns, diff.gold);
      ns = maybeDropItem(ns);
      ns = {
        ...ns,
        todos: ns.todos.map(t => t.id === todo.id ? { ...t, done: true } : t),
        logs: [{ type: "todo", msg: `✅ ${todo.label} (+${diff.xp} XP)`, ts: Date.now() }, ...ns.logs].slice(0, 50),
      };
      return ns;
    });
  };

  const deleteTodo = (id) => {
    update(s => ({ ...s, todos: s.todos.filter(t => t.id !== id) }));
  };

  const addTodo = (data) => {
    const todo = {
      id: Date.now().toString(),
      done: false,
      checklist: [],
      ...data,
    };
    update(s => ({ ...s, todos: [...s.todos, todo] }));
    setAdding(false);
  };

  const addSubtask = (todoId, label) => {
    update(s => ({
      ...s,
      todos: s.todos.map(t => t.id === todoId
        ? { ...t, checklist: [...t.checklist, { id: Date.now().toString(), label, done: false }] }
        : t),
    }));
  };

  const toggleSubtask = (todoId, subId) => {
    update(s => ({
      ...s,
      todos: s.todos.map(t => t.id === todoId
        ? { ...t, checklist: t.checklist.map(c => c.id === subId ? { ...c, done: !c.done } : c) }
        : t),
    }));
  };

  const isOverdue = (todo) => {
    if (!todo.dueDate || todo.done) return false;
    return new Date(todo.dueDate) < new Date();
  };

  return (
    <div className="rounded-xl border border-purple-800/40 bg-purple-950/30">
      <div className="flex items-center justify-between px-4 py-3 border-b border-purple-800/40">
        <h2 className="text-purple-200 font-bold text-sm uppercase tracking-wider">📝 To-Dos</h2>
        <button onClick={() => setAdding(v => !v)} className="text-purple-400 hover:text-purple-200">
          <PlusCircle className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-2">
        {adding && (
          <TaskForm
            type="todo"
            onSave={addTodo}
            onCancel={() => setAdding(false)}
          />
        )}

        {gs.todos.length === 0 && !adding && (
          <div className="text-purple-600 text-xs text-center py-6">No to-dos yet. Add one!</div>
        )}

        {gs.todos.map(todo => {
          const overdue = isOverdue(todo);
          const hasChecklist = todo.checklist?.length > 0;
          const isExpanded = expanded[todo.id];

          return (
            <div key={todo.id} className={`rounded-lg border transition-all group ${
              todo.done
                ? "border-purple-900/30 bg-purple-950/20 opacity-60"
                : overdue
                ? "border-red-700/50 bg-red-950/20"
                : "border-purple-700/40 bg-purple-900/20"
            }`}>
              <div className="flex items-center gap-2 p-3 cursor-pointer" onClick={() => complete(todo)}>
                <div className="shrink-0">
                  {todo.done
                    ? <CheckSquare className="w-5 h-5 text-green-400" />
                    : <Square className="w-5 h-5 text-purple-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${todo.done ? "line-through text-purple-600" : overdue ? "text-red-300" : "text-purple-100"}`}>
                    {todo.label}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-purple-500">{getDifficulty(todo.difficulty).label}</span>
                    {todo.dueDate && (
                      <span className={`text-[10px] ${overdue ? "text-red-400" : "text-purple-500"}`}>
                        {overdue ? "⚠️ " : "📅 "}{todo.dueDate}
                      </span>
                    )}
                    {hasChecklist && (
                      <span className="text-[10px] text-purple-500">
                        {todo.checklist.filter(c => c.done).length}/{todo.checklist.length} done
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {hasChecklist && (
                    <button onClick={e => { e.stopPropagation(); setExpanded(v => ({ ...v, [todo.id]: !v[todo.id] })); }}
                      className="text-purple-600 hover:text-purple-300">
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteTodo(todo.id); }}
                    className="opacity-0 group-hover:opacity-100 text-purple-700 hover:text-red-400 transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Checklist */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-1 border-t border-purple-800/30 pt-2">
                  {todo.checklist.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2 cursor-pointer"
                      onClick={() => toggleSubtask(todo.id, sub.id)}>
                      {sub.done
                        ? <CheckSquare className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        : <Square className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      }
                      <span className={`text-xs ${sub.done ? "line-through text-purple-600" : "text-purple-300"}`}>{sub.label}</span>
                    </div>
                  ))}
                  <SubtaskInput onAdd={(label) => addSubtask(todo.id, label)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubtaskInput({ onAdd }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex gap-1 mt-1">
      <input
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" && val.trim()) { onAdd(val.trim()); setVal(""); } }}
        placeholder="Add subtask..."
        className="flex-1 bg-purple-900/30 border border-purple-700/40 rounded px-2 py-1 text-xs text-white placeholder-purple-700 focus:outline-none"
      />
      <button onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}
        className="text-purple-500 hover:text-purple-300">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}