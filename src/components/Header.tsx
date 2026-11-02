"use client";

import { useEffect, useState } from "react";
import { useWorkshop } from "./workshop";
import { Badge, Spinner, inputCls } from "./ui";

const FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-120b", "openai/gpt-oss-20b"];

export function Header() {
  const { apiKey, setApiKey, groqModel, setGroqModel } = useWorkshop();
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "bad">("idle");
  const [models, setModels] = useState<string[]>(FALLBACK_MODELS);
  const [msg, setMsg] = useState("");

  useEffect(() => setDraft(apiKey), [apiKey]);

  const verify = async (key: string) => {
    if (!key) return;
    setStatus("checking");
    try {
      const r = await fetch("/api/models", { headers: { "x-groq-key": key } });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setModels(j.models.length ? j.models : FALLBACK_MODELS);
      setStatus("ok");
      setMsg(`${j.models.length} models available`);
    } catch (e) {
      setStatus("bad");
      setMsg(e instanceof Error ? e.message : "Key check failed");
    }
  };

  useEffect(() => {
    if (apiKey) verify(apiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-600 text-xl shadow-lg shadow-pink-500/30">
            🪨
          </div>
          <div>
            <div className="text-lg font-black leading-tight tracking-tight text-white">
              Bedrock <span className="bg-gradient-to-r from-orange-300 to-pink-400 bg-clip-text text-transparent">RAG Lab</span>
            </div>
            <div className="text-[11px] text-slate-400">Hands-on Amazon Bedrock Knowledge Bases · zero AWS credits</div>
          </div>
          <Badge color="orange">SIMULATION MODE</Badge>
        </div>

        <form
          className="ml-auto flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setApiKey(draft.trim());
            verify(draft.trim());
          }}
        >
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Paste your Groq API key (gsk_…)"
              className={`${inputCls} w-64 pr-14 font-mono text-xs`}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white">
              {show ? "hide" : "show"}
            </button>
          </div>
          <button type="submit" className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20">
            {status === "checking" ? <Spinner /> : "Save key"}
          </button>
          {apiKey && (
            <button
              type="button"
              onClick={() => {
                setApiKey("");
                setDraft("");
                setStatus("idle");
                setMsg("");
              }}
              className="rounded-lg px-2 py-2 text-xs text-slate-400 hover:text-rose-300"
            >
              forget
            </button>
          )}
          <select value={groqModel} onChange={(e) => setGroqModel(e.target.value)} className={`${inputCls} w-56 text-xs`} title="Groq model used as the Bedrock generation model stand-in">
            {[...new Set([groqModel, ...models])].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <span className="flex items-center gap-1.5 text-xs" title={msg}>
            <span
              className={`h-2.5 w-2.5 rounded-full ${status === "ok" ? "bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400" : status === "bad" ? "bg-rose-500" : "bg-slate-500"}`}
            />
            <span className="hidden text-slate-400 xl:inline">{status === "ok" ? "Groq connected" : status === "bad" ? msg : "BYOK: key stays in your browser"}</span>
          </span>
        </form>
      </div>
    </header>
  );
}
