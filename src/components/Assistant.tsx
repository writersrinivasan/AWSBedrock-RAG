"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { STEPS } from "@/lib/steps";
import { useWorkshop } from "./workshop";
import { Spinner } from "./ui";

type Msg = { role: "user" | "assistant"; content: string };

// Minimal markdown: code fences, inline code, bold, bullets. Enough for chat answers.
export function MiniMarkdown({ text }: { text: string }) {
  const blocks = text.split(/```/);
  return (
    <>
      {blocks.map((b, i) =>
        i % 2 ? (
          <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-[12px] text-emerald-200">
            {b.replace(/^\w*\n/, "")}
          </pre>
        ) : (
          <div key={i}>
            {b.split("\n").map((line, j) => {
              const bullet = /^\s*([-*]|\d+\.)\s+/.test(line);
              const heading = /^#{1,4}\s/.test(line);
              const content = inline(line.replace(/^\s*[-*]\s+/, "").replace(/^#{1,4}\s/, ""));
              if (!line.trim()) return <div key={j} className="h-2" />;
              return (
                <div key={j} className={`${bullet ? "ml-3 flex gap-2" : ""} ${heading ? "mt-2 font-bold text-white" : ""}`}>
                  {bullet && !/^\s*\d+\./.test(line) && <span className="text-pink-400">•</span>}
                  <span>{content}</span>
                </div>
              );
            })}
          </div>
        ),
      )}
    </>
  );
}

function inline(s: string): ReactNode[] {
  return s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("`") ? (
      <code key={i} className="rounded bg-black/40 px-1 py-0.5 text-[12px] text-amber-200">
        {p.slice(1, -1)}
      </code>
    ) : p.startsWith("**") ? (
      <strong key={i} className="text-white">
        {p.slice(2, -2)}
      </strong>
    ) : (
      p
    ),
  );
}

const QUICK = ["Explain this step like I'm new to AWS", "What do I do next?", "What would this cost on real AWS?", "What are common mistakes here?"];

export function Assistant() {
  const { step, apiKey, groqModel, kbConfig, synced, index } = useWorkshop();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const meta = STEPS[step - 1];

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const context = `Current step ${meta.n}/10: ${meta.title} — ${meta.summary}
Next step: ${STEPS[step]?.title ?? "(workshop complete)"}
KB config: ${JSON.stringify(kbConfig)}
Ingestion synced: ${synced} (${index.stats.chunks} chunks from ${index.stats.documents} documents)`;
      const r = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-groq-key": apiKey },
        body: JSON.stringify({ messages: next, context, groqModel }),
      });
      const j = await r.json();
      setMsgs([...next, { role: "assistant", content: j.reply ?? `⚠️ ${j.error}` }]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Request failed"}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 px-5 py-3 font-bold text-white shadow-2xl shadow-pink-500/40 transition hover:scale-105"
      >
        <span className="text-xl">🤖</span> {open ? "Close coach" : "Ask Bedrock Coach"}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[70vh] w-[min(440px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <div className="bg-gradient-to-r from-fuchsia-600/40 via-pink-600/30 to-orange-500/30 px-4 py-3">
            <div className="font-bold text-white">🤖 Bedrock Coach</div>
            <div className="text-xs text-slate-300">
              LangGraph agent · Groq <span className="font-mono">{groqModel}</span> · knows you are on step {step}
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {!apiKey && (
              <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-amber-100">
                Paste your Groq API key in the header to talk to the coach. Get a free key at console.groq.com/keys.
              </div>
            )}
            {msgs.length === 0 && (
              <div className="text-slate-400">
                Ask anything about <b className="text-slate-200">{meta.title}</b>, Bedrock APIs, pricing, or what to show next.
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl rounded-br-sm bg-gradient-to-r from-orange-500/80 to-pink-500/80 p-3 text-white" : "mr-4 rounded-2xl rounded-bl-sm bg-white/5 p-3 leading-relaxed text-slate-200 ring-1 ring-white/10"}>
                {m.role === "assistant" ? <MiniMarkdown text={m.content} /> : m.content}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-slate-400">
                <Spinner /> thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-3 pt-2">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={!apiKey || busy} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40">
                {q}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the coach…" disabled={!apiKey} className="flex-1 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-pink-400/50" />
            <button disabled={!apiKey || busy} className="rounded-xl bg-pink-500 px-4 text-sm font-bold text-white disabled:opacity-40">
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
