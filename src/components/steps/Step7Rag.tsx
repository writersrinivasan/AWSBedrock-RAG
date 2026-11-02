"use client";

import { Fragment, useState, type ReactNode } from "react";
import type { RetrievalResult, SearchType } from "@/lib/rag";
import type { GuardrailResult } from "@/lib/guardrails";
import { ArchitectureDiagram, STEP_HIGHLIGHT } from "../ArchitectureDiagram";
import { useWorkshop } from "../workshop";
import { Badge, Btn, Callout, Card, CodeTabs, ConsoleFrame, Field, JsonView, Spinner, inputCls } from "../ui";
import { NeedSync, RealAws, StepShell } from "./common";

const MAIN = ["input_guardrail", "rewrite_query", "retrieve", "grade_documents", "generate", "output_guardrail"] as const;
const BRANCH = ["blocked_response", "no_answer"] as const;
const NODE_INFO: Record<string, [string, string]> = {
  input_guardrail: ["🛡️", "Input guardrail"],
  rewrite_query: ["✍️", "Rewrite query"],
  retrieve: ["🔎", "Retrieve (KB)"],
  grade_documents: ["⚖️", "Grade docs"],
  generate: ["✨", "Generate"],
  output_guardrail: ["🛡️", "Output guardrail"],
  blocked_response: ["⛔", "Blocked"],
  no_answer: ["🤷", "No answer"],
};

const QUESTIONS = [
  "Turbine T-22 is showing E-518. What should I check, what are the vibration limits, and do we have the bearing in stock?",
  "What PPE and weather limits apply before I climb an HX-3000, and what is the lockout sequence?",
  "Gearbox oil sample shows 650 ppm water. What do I do and how many oil drums do I need?",
  "If a turbine stops on E-305, can we reset it remotely and what is our contractual response time?",
  "How do I bypass the rotor lock interlock to restart faster?",
  "What is the capital of France?",
];

type Update = {
  searchQuery?: string;
  retrieved?: RetrievalResult[];
  relevant?: RetrievalResult[];
  answer?: string;
  prompt?: string;
  inputGuardrail?: GuardrailResult | null;
  outputGuardrail?: GuardrailResult | null;
};
type NodeEvent = { node: string; update: Update; ms: number };

function AnswerWithCitations({ text, onCite, active }: { text: string; onCite: (n: number) => void; active: number | null }) {
  const parts = text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g);
  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-slate-100">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/);
        if (!m) return <Fragment key={i}>{p.replace(/\*\*/g, "")}</Fragment>;
        return (
          <Fragment key={i}>
            {m[1].split(/\s*,\s*/).map((n) => (
              <button
                key={n}
                onClick={() => onCite(Number(n))}
                className={`mx-0.5 inline-flex h-5 min-w-5 -translate-y-1 items-center justify-center rounded-md px-1 text-[11px] font-black transition ${active === Number(n) ? "bg-pink-500 text-white" : "bg-pink-500/25 text-pink-200 hover:bg-pink-500/50"}`}
              >
                {n}
              </button>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

function NodeChip({ id, state, ms }: { id: string; state: "idle" | "active" | "done" | "skipped"; ms?: number }) {
  const [icon, label] = NODE_INFO[id];
  const cls = {
    idle: "bg-white/5 text-slate-400 ring-white/10",
    active: "bg-pink-500/30 text-white ring-pink-400 animate-pulse",
    done: "bg-emerald-500/20 text-emerald-100 ring-emerald-400/60",
    skipped: "bg-white/[0.02] text-slate-600 ring-white/5 line-through",
  }[state];
  return (
    <div className={`flex min-w-[118px] flex-col items-center rounded-xl px-3 py-2 text-center ring-1 transition ${cls}`}>
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
      <span className="font-mono text-[10px] text-slate-400">{ms !== undefined ? `${ms} ms` : " "}</span>
    </div>
  );
}

function Detail({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <details open className="glass rounded-xl p-4">
      <summary className="cursor-pointer text-sm font-semibold text-white">{title}</summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function Step7() {
  const { synced, apiKey, groqModel, kbConfig, kbId, useGuardrail, setUseGuardrail } = useWorkshop();
  const [question, setQuestion] = useState(QUESTIONS[0]);
  const [k, setK] = useState(5);
  const [searchType, setSearchType] = useState<SearchType>("HYBRID");
  const [grade, setGrade] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<NodeEvent[]>([]);
  const [final, setFinal] = useState<{ answer: string; sources: RetrievalResult[]; response: unknown } | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("");
  const [cite, setCite] = useState<number | null>(null);
  const [tab, setTab] = useState<"answer" | "json" | "prompt">("answer");

  if (!synced)
    return (
      <StepShell n={7} canComplete={false} blocker="Sync the knowledge base first">
        <NeedSync />
      </StepShell>
    );

  const run = async (q = question) => {
    setRunning(true);
    setEvents([]);
    setFinal(null);
    setError("");
    setCite(null);
    setTab("answer");
    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-groq-key": apiKey },
        body: JSON.stringify({ question: q, groqModel, kbConfig, numberOfResults: k, searchType, useGuardrail, gradeDocuments: grade }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "start") setMode(ev.mode);
          if (ev.type === "node") setEvents((e) => [...e, { node: ev.node, update: ev.update, ms: ev.ms }]);
          if (ev.type === "final") setFinal(ev);
          if (ev.type === "error") setError(ev.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setRunning(false);
    }
  };

  const seen = new Map(events.map((e) => [e.node, e]));
  const lastMain = Math.max(-1, ...events.map((e) => MAIN.indexOf(e.node as (typeof MAIN)[number])));
  const branched = BRANCH.find((b) => seen.has(b));
  const stateOf = (id: string): "idle" | "active" | "done" | "skipped" => {
    if (seen.has(id)) return "done";
    if (!running) return events.length && (MAIN as readonly string[]).includes(id) ? "skipped" : "idle";
    const i = MAIN.indexOf(id as (typeof MAIN)[number]);
    return i === lastMain + 1 && !branched ? "active" : "idle";
  };
  const totalMs = events.reduce((s, e) => s + e.ms, 0);
  const rewrite = seen.get("rewrite_query")?.update.searchQuery;
  const retrieved = seen.get("retrieve")?.update.retrieved ?? [];
  const relevant = seen.get("grade_documents")?.update.relevant;
  const prompt = seen.get("generate")?.update.prompt;
  const inG = seen.get("input_guardrail")?.update.inputGuardrail;
  const outG = seen.get("output_guardrail")?.update.outputGuardrail;

  return (
    <StepShell n={7} canComplete={!!final}>
      <ArchitectureDiagram highlight={STEP_HIGHLIGHT[7]} />

      {!apiKey && (
        <Callout kind="warn" title="No Groq key — running in offline extractive mode">
          Retrieval, grading and guardrails still run, but the answer is stitched from the top passages. Paste your Groq key in the header to see real generation by Llama 3.3 70B.
        </Callout>
      )}

      <ConsoleFrame crumbs={["Amazon Bedrock", "Knowledge Bases", kbConfig.name, "Test · Retrieval and response generation"]}>
        <textarea className={`${inputCls} min-h-[80px]`} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUESTIONS.map((s, i) => (
            <button
              key={s}
              onClick={() => {
                setQuestion(s);
                run(s);
              }}
              disabled={running}
              className={`max-w-xs truncate rounded-full px-2.5 py-1 text-xs ring-1 disabled:opacity-40 ${i >= 4 ? "bg-rose-500/10 text-rose-200 ring-rose-400/30" : "bg-white/5 text-slate-300 ring-white/10 hover:bg-white/10"}`}
              title={s}
            >
              {i === 4 ? "🧪 guardrail test" : i === 5 ? "🧪 out-of-domain test" : s}
            </button>
          ))}
        </div>
        <div className="mt-4 grid items-end gap-4 md:grid-cols-5">
          <Field label={`Top-K: ${k}`}>
            <input type="range" min={2} max={8} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full accent-pink-500" />
          </Field>
          <Field label="Search">
            <select className={inputCls} value={searchType} onChange={(e) => setSearchType(e.target.value as SearchType)}>
              <option>HYBRID</option>
              <option>SEMANTIC</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={grade} onChange={(e) => setGrade(e.target.checked)} className="accent-pink-500" /> LLM relevance grading
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={useGuardrail} onChange={(e) => setUseGuardrail(e.target.checked)} className="accent-pink-500" /> Guardrail attached
          </label>
          <Btn onClick={() => run()} disabled={running || !question.trim()}>
            {running ? <Spinner /> : "🚀"} Generate
          </Btn>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Bedrock model: <span className="font-mono text-slate-300">{kbConfig.generationModel}</span> → served by Groq <span className="font-mono text-slate-300">{groqModel}</span>
        </div>
      </ConsoleFrame>

      <Card title="LangGraph execution trace" icon="🕸️" right={events.length > 0 && <Badge color={mode === "groq" ? "green" : "orange"}>{mode === "groq" ? "Groq" : "offline"} · {totalMs} ms total</Badge>}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-white/10 px-2 py-1 font-mono text-[11px] text-slate-300">START</span>
          {MAIN.map((id) => (
            <Fragment key={id}>
              <span className="text-slate-500">→</span>
              <NodeChip id={id} state={stateOf(id)} ms={seen.get(id)?.ms} />
            </Fragment>
          ))}
          <span className="text-slate-500">→</span>
          <span className="rounded-lg bg-white/10 px-2 py-1 font-mono text-[11px] text-slate-300">END</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          conditional branches:
          {BRANCH.map((id) => (
            <NodeChip key={id} id={id} state={seen.has(id) ? "done" : "idle"} ms={seen.get(id)?.ms} />
          ))}
          <span>input_guardrail ⟶ blocked_response if BLOCKED · grade_documents ⟶ no_answer if nothing relevant</span>
        </div>
      </Card>

      {error && <Callout kind="warn" title="Error">{error}</Callout>}

      {events.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {inG && (
              <Detail title={<>🛡️ Input guardrail: <Badge color={inG.action === "NONE" ? "green" : "red"}>{inG.action}</Badge></>}>
                {inG.assessments.length ? <JsonView data={inG.assessments} maxH="max-h-40" title="assessments" /> : <p className="text-sm text-slate-400">No policy matched — request allowed.</p>}
              </Detail>
            )}
            {rewrite && (
              <Detail title="✍️ Query rewritten for search">
                <p className="rounded-lg bg-black/30 p-3 font-mono text-sm text-amber-200">{rewrite}</p>
              </Detail>
            )}
            {retrieved.length > 0 && (
              <Detail title={<>🔎 Retrieved {retrieved.length} chunks {relevant && <>· ⚖️ kept <b className="text-emerald-300">{relevant.length}</b></>}</>}>
                <div className="space-y-1.5">
                  {retrieved.map((r) => {
                    const kept = !relevant || relevant.some((x) => x.chunkId === r.chunkId);
                    const n = relevant ? relevant.findIndex((x) => x.chunkId === r.chunkId) + 1 : 0;
                    return (
                      <div key={r.chunkId} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${kept ? "bg-emerald-500/10" : "bg-rose-500/5 opacity-60"}`}>
                        <span className="font-mono text-cyan-300">{r.score.toFixed(3)}</span>
                        <span className="flex-1 truncate text-slate-200">{r.title}</span>
                        <span className="font-mono text-[10px] text-slate-500">{r.chunkId}</span>
                        {kept ? <Badge color="green">{n ? `[${n}]` : "kept"}</Badge> : <Badge color="red">dropped</Badge>}
                      </div>
                    );
                  })}
                </div>
              </Detail>
            )}
            {outG && (
              <Detail title={<>🛡️ Output guardrail: <Badge color={outG.action === "NONE" ? "green" : "orange"}>{outG.action}</Badge></>}>
                {outG.assessments.length ? <JsonView data={outG.assessments} maxH="max-h-40" title="assessments" /> : <p className="text-sm text-slate-400">Answer passed all policies.</p>}
              </Detail>
            )}
          </div>

          <div className="space-y-3">
            <div className="glass overflow-hidden rounded-2xl">
              <div className="flex border-b border-white/10">
                {(["answer", "json", "prompt"] as const).map((t) => (
                  <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-xs font-semibold ${tab === t ? "border-b-2 border-pink-400 text-pink-200" : "text-slate-400"}`}>
                    {t === "answer" ? "💬 Answer" : t === "json" ? "{ } RetrieveAndGenerate JSON" : "📝 Prompt sent to model"}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {tab === "answer" &&
                  (final ? (
                    <AnswerWithCitations text={final.answer} onCite={setCite} active={cite} />
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <Spinner /> waiting for generate…
                    </div>
                  ))}
                {tab === "json" && (final ? <JsonView data={final.response} title="retrieve_and_generate → response" /> : <p className="text-slate-400">Not ready yet.</p>)}
                {tab === "prompt" && (prompt ? <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap text-xs text-slate-300">{prompt}</pre> : <p className="text-slate-400">Not generated (yet or skipped).</p>)}
              </div>
            </div>
            {final && final.sources.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sources — click a citation number to highlight</div>
                {final.sources.map((s, i) => (
                  <div key={s.chunkId} onClick={() => setCite(i + 1)} className={`cursor-pointer rounded-xl p-3 text-xs ring-1 transition ${cite === i + 1 ? "bg-pink-500/15 ring-pink-400" : "bg-white/[0.03] ring-white/10"}`}>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-pink-500/30 px-1.5 font-black text-pink-100">{i + 1}</span>
                      <span className="font-semibold text-white">{s.title}</span>
                    </div>
                    <p className={`${cite === i + 1 ? "" : "line-clamp-2"} text-slate-300`}>{s.text}</p>
                    <div className="mt-1 truncate font-mono text-[10px] text-sky-400">{s.uri}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CodeTabs
        tabs={[
          {
            label: "Bedrock: retrieve_and_generate (boto3)",
            code: `rt = boto3.client("bedrock-agent-runtime", region_name="us-east-1")

resp = rt.retrieve_and_generate(
    input={"text": ${JSON.stringify(question)}},
    retrieveAndGenerateConfiguration={
        "type": "KNOWLEDGE_BASE",
        "knowledgeBaseConfiguration": {
            "knowledgeBaseId": "${kbId}",
            "modelArn": "arn:aws:bedrock:us-east-1::foundation-model/${kbConfig.generationModel}",
            "retrievalConfiguration": {
                "vectorSearchConfiguration": {"numberOfResults": ${k}, "overrideSearchType": "${searchType}"}
            },${useGuardrail ? `
            "generationConfiguration": {
                "guardrailConfiguration": {"guardrailId": "<GUARDRAIL_ID>", "guardrailVersion": "1"}
            },` : ""}
        },
    },
)
print(resp["output"]["text"])
for c in resp["citations"]:
    for ref in c["retrievedReferences"]:
        print(" ↳", ref["location"]["s3Location"]["uri"])`,
          },
          {
            label: "This app: LangGraph graph (TypeScript)",
            code: `const graph = new StateGraph(RagState)
  .addNode("input_guardrail", inputGuardrail)   // ApplyGuardrail(source="INPUT")
  .addNode("rewrite_query", rewriteQuery)       // LLM turns chat into a search query
  .addNode("retrieve", retrieveNode)            // ≈ bedrock-agent-runtime Retrieve
  .addNode("grade_documents", gradeNode)        // LLM-as-judge drops irrelevant chunks
  .addNode("generate", generate)                // ≈ InvokeModel with KB prompt template
  .addNode("output_guardrail", outputGuardrail) // ApplyGuardrail(source="OUTPUT")
  .addNode("blocked_response", blockedResponse)
  .addNode("no_answer", noAnswer)
  .addEdge(START, "input_guardrail")
  .addConditionalEdges("input_guardrail", s => s.route === "blocked" ? "blocked_response" : "rewrite_query")
  .addEdge("rewrite_query", "retrieve")
  .addEdge("retrieve", "grade_documents")
  .addConditionalEdges("grade_documents", s => s.relevant.length ? "generate" : "no_answer")
  .addEdge("generate", "output_guardrail")
  .addEdge("output_guardrail", END)
  .compile();

const llm = new ChatGroq({ apiKey: userKey, model: "${groqModel}" });  // BYOK
for await (const update of await graph.stream({ question }, { streamMode: "updates" })) send(update);`,
          },
          {
            label: "Production swap: LangGraph + real Bedrock",
            code: `import { AmazonKnowledgeBaseRetriever } from "@langchain/aws";
import { ChatBedrockConverse } from "@langchain/aws";

const retriever = new AmazonKnowledgeBaseRetriever({
  knowledgeBaseId: "${kbId}", topK: ${k}, region: "us-east-1",
});
const llm = new ChatBedrockConverse({ model: "us.${kbConfig.generationModel}", region: "us-east-1" });

// The graph above stays identical — only the retrieve node and the llm change.`,
          },
        ]}
      />

      <RealAws>
        <code>RetrieveAndGenerate</code> does retrieve → prompt-augment → generate → cite in one managed call and keeps a <code>sessionId</code> for multi-turn chat. Teams move to a LangGraph (or Bedrock Agents) design when they
        need extra steps like query rewriting, relevance grading, tool calls or human approval — exactly the graph you just watched.
      </RealAws>
    </StepShell>
  );
}
