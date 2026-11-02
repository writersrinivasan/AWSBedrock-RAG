"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildIndex, DEFAULT_KB_CONFIG, type KbConfig, type KbIndex } from "@/lib/rag";
import { STEPS } from "@/lib/steps";

type Workshop = {
  step: number;
  goTo: (n: number) => void;
  done: Set<number>;
  complete: (n: number, advance?: boolean) => void;
  apiKey: string;
  setApiKey: (k: string) => void;
  groqModel: string;
  setGroqModel: (m: string) => void;
  kbConfig: KbConfig;
  setKbConfig: (c: KbConfig) => void;
  index: KbIndex;
  kbId: string | null;
  setKbId: (id: string | null) => void;
  synced: boolean;
  setSynced: (b: boolean) => void;
  useGuardrail: boolean;
  setUseGuardrail: (b: boolean) => void;
  reset: () => void;
};

const Ctx = createContext<Workshop | null>(null);

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

export function WorkshopProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState(1);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [apiKey, setApiKeyState] = useState("");
  const [groqModel, setGroqModelState] = useState("llama-3.3-70b-versatile");
  const [kbConfig, setKbConfigState] = useState<KbConfig>(DEFAULT_KB_CONFIG);
  const [kbId, setKbId] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [useGuardrail, setUseGuardrail] = useState(true);

  useEffect(() => {
    setApiKeyState(read("groq-key") ?? "");
    setGroqModelState(read("groq-model") ?? "llama-3.3-70b-versatile");
  }, []);

  const index = useMemo(() => buildIndex(kbConfig), [kbConfig]);

  const value: Workshop = {
    step,
    goTo: (n) => {
      setStep(Math.min(STEPS.length, Math.max(1, n)));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    done,
    complete: (n, advance = true) => {
      setDone((d) => new Set(d).add(n));
      if (advance && n < STEPS.length) {
        setStep(n + 1);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    apiKey,
    setApiKey: (k) => {
      setApiKeyState(k);
      write("groq-key", k || null);
    },
    groqModel,
    setGroqModel: (m) => {
      setGroqModelState(m);
      write("groq-model", m);
    },
    kbConfig,
    setKbConfig: (c) => {
      setKbConfigState(c);
      setSynced(false);
    },
    index,
    kbId,
    setKbId,
    synced,
    setSynced,
    useGuardrail,
    setUseGuardrail,
    reset: () => {
      setDone(new Set());
      setKbId(null);
      setSynced(false);
      setKbConfigState(DEFAULT_KB_CONFIG);
      setStep(1);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkshop() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWorkshop outside provider");
  return c;
}
