"use client";

import { useEffect, useState } from "react";
import { STEPS } from "@/lib/steps";
import { useWorkshop } from "./workshop";

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function Sidebar() {
  const { step, goTo, done, reset } = useWorkshop();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const planned = STEPS.slice(0, step).reduce((s, x) => s + x.minutes, 0) * 60;
  const behind = elapsed > planned;
  const pct = Math.round((done.size / STEPS.length) * 100);

  return (
    <aside className="lg:sticky lg:top-[72px] lg:h-[calc(100vh-88px)] lg:overflow-y-auto">
      <div className="glass mb-4 rounded-2xl p-4">
        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
          <span>Session clock</span>
          <span>60 min</span>
        </div>
        <div className="flex items-end justify-between">
          <div className={`font-mono text-3xl font-black ${behind ? "text-amber-300" : "text-emerald-300"}`}>{fmt(elapsed)}</div>
          <div className="flex gap-1">
            <button onClick={() => setRunning(!running)} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20">
              {running ? "⏸ Pause" : "▶ Start"}
            </button>
            <button onClick={() => { setElapsed(0); setRunning(false); }} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-white">
              ↺
            </button>
          </div>
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Target to finish step {step}: <span className="font-mono text-slate-200">{fmt(planned)}</span> {behind && <span className="text-amber-300">· running behind</span>}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-orange-400 via-pink-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-right text-[11px] text-slate-400">{pct}% complete</div>
      </div>

      <nav className="glass rounded-2xl p-2">
        {STEPS.map((s) => {
          const active = s.n === step;
          const isDone = done.has(s.n);
          return (
            <button
              key={s.n}
              onClick={() => goTo(s.n)}
              className={`group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${active ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  isDone ? "bg-emerald-500 text-white" : active ? `bg-gradient-to-br ${s.gradient} text-white` : "bg-white/5 text-slate-400"
                }`}
              >
                {isDone ? "✓" : s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${active ? "text-white" : "text-slate-300"}`}>
                  {s.n}. {s.short}
                </span>
                <span className="block text-[11px] text-slate-500">{s.minutes} min</span>
              </span>
            </button>
          );
        })}
        <button onClick={reset} className="mt-2 w-full rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-rose-300">
          Reset workshop
        </button>
      </nav>
    </aside>
  );
}
