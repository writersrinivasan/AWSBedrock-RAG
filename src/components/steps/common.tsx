"use client";

import type { ReactNode } from "react";
import { STEPS } from "@/lib/steps";
import { useWorkshop } from "../workshop";
import { Btn, Callout, StepHeader } from "../ui";

export function StepShell({ n, children, canComplete = true, blocker }: { n: number; children: ReactNode; canComplete?: boolean; blocker?: string }) {
  const { complete, goTo, done } = useWorkshop();
  const meta = STEPS[n - 1];
  const next = STEPS[n];
  return (
    <div className="animate-in">
      <StepHeader n={n} title={meta.title} minutes={meta.minutes} gradient={meta.gradient}>
        {meta.summary}
      </StepHeader>
      <div className="space-y-6">{children}</div>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <Btn variant="ghost" onClick={() => goTo(n - 1)} disabled={n === 1}>
          ← Previous
        </Btn>
        <div className="text-sm text-slate-400">{!canComplete && blocker ? <span className="text-amber-300">{blocker}</span> : next ? <>Up next: <b className="text-slate-200">{next.icon} {next.title}</b></> : "Last step"}</div>
        <Btn onClick={() => complete(n)} disabled={!canComplete} variant={done.has(n) ? "success" : "primary"}>
          {done.has(n) ? "✓ Done — " : "Mark done — "}
          {next ? "Next step →" : "Finish 🎉"}
        </Btn>
      </div>
    </div>
  );
}

export function RealAws({ children }: { children: ReactNode }) {
  return (
    <Callout kind="aws" title="What happens on real AWS">
      {children}
    </Callout>
  );
}

export function NeedSync() {
  const { goTo, kbId } = useWorkshop();
  return (
    <Callout kind="warn" title="The knowledge base is not synced yet">
      Retrieval needs indexed vectors. {kbId ? "Run the ingestion sync first." : "Create the knowledge base and run the sync first."}
      <div className="mt-2">
        <Btn variant="ghost" onClick={() => goTo(kbId ? 5 : 4)}>
          Go to step {kbId ? 5 : 4} →
        </Btn>
      </div>
    </Callout>
  );
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const fakeId = (len = 10) => {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: len }, () => a[Math.floor(Math.random() * a.length)]).join("");
};

export function VectorStrip({ vector, cells = 64 }: { vector: number[]; cells?: number }) {
  const slice = vector.slice(0, cells);
  const max = Math.max(...slice.map(Math.abs)) || 1;
  return (
    <div className="flex h-6 overflow-hidden rounded-md ring-1 ring-white/10" title={`first ${cells} of ${vector.length} dimensions`}>
      {slice.map((v, i) => {
        const t = v / max;
        const bg = t >= 0 ? `rgba(236,72,153,${0.1 + 0.9 * t})` : `rgba(34,211,238,${0.1 + 0.9 * -t})`;
        return <div key={i} className="flex-1" style={{ background: bg }} />;
      })}
    </div>
  );
}
