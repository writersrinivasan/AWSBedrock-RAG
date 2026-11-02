"use client";

import { useState, type ReactNode } from "react";

export function Card({ title, icon, children, className = "", right }: { title?: ReactNode; icon?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={`glass rounded-2xl p-5 ${className}`}>
      {title && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-white">
            {icon && <span className="text-lg">{icon}</span>}
            {title}
          </h3>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger" | "success";
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-gradient-to-r from-orange-500 via-pink-500 to-violet-500 text-white shadow-lg shadow-pink-500/20 hover:brightness-110",
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:brightness-110",
    danger: "bg-gradient-to-r from-rose-600 to-red-500 text-white hover:brightness-110",
    ghost: "border border-white/15 bg-white/5 text-slate-100 hover:bg-white/10",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

const BADGE = {
  orange: "bg-orange-500/15 text-orange-300 ring-orange-400/30",
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
  blue: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
  pink: "bg-pink-500/15 text-pink-300 ring-pink-400/30",
  violet: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
  red: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  slate: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
};

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: keyof typeof BADGE }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${BADGE[color]}`}>{children}</span>;
}

export function Callout({ kind = "info", title, children }: { kind?: "info" | "tip" | "warn" | "aws"; title?: string; children: ReactNode }) {
  const s = {
    info: ["border-sky-400/40 bg-sky-500/10", "💡"],
    tip: ["border-emerald-400/40 bg-emerald-500/10", "✅"],
    warn: ["border-amber-400/40 bg-amber-500/10", "⚠️"],
    aws: ["border-orange-400/40 bg-orange-500/10", "☁️"],
  }[kind];
  return (
    <div className={`rounded-xl border-l-4 p-4 text-sm leading-relaxed text-slate-200 ${s[0]}`}>
      {title && (
        <div className="mb-1 font-semibold text-white">
          {s[1]} {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setOk(true);
          setTimeout(() => setOk(false), 1200);
        });
      }}
      className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300 hover:bg-white/10"
    >
      {ok ? "Copied ✓" : "Copy"}
    </button>
  );
}

export function CodeTabs({ tabs }: { tabs: { label: string; code: string }[] }) {
  const [i, setI] = useState(0);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1020]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-2">
        <div className="flex overflow-x-auto">
          {tabs.map((t, idx) => (
            <button
              key={t.label}
              onClick={() => setI(idx)}
              className={`whitespace-nowrap px-3 py-2 text-xs font-medium transition ${idx === i ? "border-b-2 border-orange-400 text-orange-300" : "text-slate-400 hover:text-slate-200"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <CopyBtn text={tabs[i].code} />
      </div>
      <pre className="max-h-[420px] overflow-auto p-4 text-[12.5px] leading-relaxed text-slate-200">
        <code>{tabs[i].code}</code>
      </pre>
    </div>
  );
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function JsonView({ data, title, maxH = "max-h-[420px]" }: { data: unknown; title?: string; maxH?: string }) {
  const json = JSON.stringify(data, null, 2);
  const html = esc(json).replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      const cls = m.startsWith('"') ? (m.endsWith(":") ? "text-sky-300" : "text-emerald-300") : /true|false|null/.test(m) ? "text-pink-300" : "text-amber-300";
      return `<span class="${cls}">${m}</span>`;
    },
  );
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1020]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
        <span className="font-mono">{title ?? "response.json"}</span>
        <CopyBtn text={json} />
      </div>
      <pre className={`${maxH} overflow-auto p-4 text-[12px] leading-relaxed`} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// A neutral, clearly-labelled mock of a cloud console page, used to show "where you would click".
export function ConsoleFrame({ crumbs, children }: { crumbs: string[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0f1729]">
      <div className="flex items-center justify-between bg-[#161e2d] px-3 py-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded bg-orange-500 px-1.5 py-0.5 font-bold text-slate-900">Console</span>
          <span className="text-slate-400">us-east-1 · N. Virginia</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-amber-300/80">simulated console</span>
      </div>
      <div className="border-b border-white/5 px-4 py-2 text-xs text-sky-300">{crumbs.join("  ›  ")}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 outline-none ring-orange-400/50 placeholder:text-slate-500 focus:ring-2";

export function StepHeader({ n, title, minutes, gradient, children }: { n: number; title: string; minutes: number; gradient: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-lg font-black text-white shadow-lg`}>{n}</span>
        <Badge color="orange">⏱ ~{minutes} min</Badge>
      </div>
      <h2 className={`bg-gradient-to-r ${gradient} bg-clip-text text-3xl font-black tracking-tight text-transparent md:text-4xl`}>{title}</h2>
      <p className="mt-2 max-w-3xl text-slate-300">{children}</p>
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />;
}
