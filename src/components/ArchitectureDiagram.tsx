"use client";

type NodeDef = { id: string; x: number; y: number; title: string; sub: string; icon: string; c1: string; c2: string };

const W = 170;
const H = 74;

const NODES: NodeDef[] = [
  { id: "docs", x: 10, y: 40, title: "Source docs", sub: "PDF · XLSX · DOCX", icon: "📄", c1: "#f97316", c2: "#ec4899" },
  { id: "s3", x: 210, y: 40, title: "Amazon S3", sub: "data source bucket", icon: "🪣", c1: "#10b981", c2: "#14b8a6" },
  { id: "kb", x: 410, y: 40, title: "Knowledge Base", sub: "parse + chunk", icon: "🧠", c1: "#0ea5e9", c2: "#6366f1" },
  { id: "embed", x: 610, y: 40, title: "Titan Embed V2", sub: "text → 1024-d vector", icon: "🧬", c1: "#8b5cf6", c2: "#d946ef" },
  { id: "vec", x: 810, y: 40, title: "Vector store", sub: "OpenSearch Serverless", icon: "🗄️", c1: "#06b6d4", c2: "#3b82f6" },
  { id: "app", x: 10, y: 250, title: "Technician app", sub: "Next.js + LangGraph", icon: "👷", c1: "#f59e0b", c2: "#f97316" },
  { id: "guard", x: 210, y: 250, title: "Guardrails", sub: "topics · PII · attacks", icon: "🛡️", c1: "#84cc16", c2: "#10b981" },
  { id: "retrieve", x: 410, y: 250, title: "Retrieve", sub: "top-K similarity", icon: "🔎", c1: "#22d3ee", c2: "#3b82f6" },
  { id: "fm", x: 610, y: 250, title: "Foundation model", sub: "Llama 3.3 70B", icon: "✨", c1: "#ec4899", c2: "#f43f5e" },
  { id: "answer", x: 810, y: 250, title: "Cited answer", sub: "text + S3 citations", icon: "💬", c1: "#eab308", c2: "#f59e0b" },
];

const EDGES: [string, string, string?][] = [
  ["docs", "s3"],
  ["s3", "kb"],
  ["kb", "embed"],
  ["embed", "vec"],
  ["app", "guard"],
  ["guard", "retrieve"],
  ["retrieve", "fm"],
  ["fm", "answer"],
];

export const STEP_HIGHLIGHT: Record<number, string[]> = {
  1: NODES.map((n) => n.id),
  2: ["embed", "fm"],
  3: ["docs", "s3"],
  4: ["kb", "embed", "vec"],
  5: ["s3", "kb", "embed", "vec"],
  6: ["app", "retrieve", "vec", "embed"],
  7: ["app", "guard", "retrieve", "vec", "fm", "answer"],
  8: ["guard", "app", "answer"],
  9: ["retrieve", "answer"],
  10: NODES.map((n) => n.id),
};

const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

export function ArchitectureDiagram({ highlight = NODES.map((n) => n.id), vectorStore }: { highlight?: string[]; vectorStore?: string }) {
  const on = (id: string) => highlight.includes(id);
  return (
    <svg viewBox="0 0 990 340" className="h-auto w-full" role="img" aria-label="Amazon Bedrock Knowledge Base RAG architecture">
      <defs>
        {NODES.map((n) => (
          <linearGradient key={n.id} id={`g-${n.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={n.c1} />
            <stop offset="1" stopColor={n.c2} />
          </linearGradient>
        ))}
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#cbd5e1" />
        </marker>
      </defs>

      <text x="10" y="24" fill="#fdba74" fontSize="13" fontWeight="700" letterSpacing="2">① INGESTION (offline, on every sync)</text>
      <text x="10" y="234" fill="#f9a8d4" fontSize="13" fontWeight="700" letterSpacing="2">② QUERY TIME (RetrieveAndGenerate)</text>

      {EDGES.map(([a, b]) => {
        const A = byId[a];
        const B = byId[b];
        const active = on(a) && on(b);
        return (
          <line
            key={a + b}
            x1={A.x + W}
            y1={A.y + H / 2}
            x2={B.x - 4}
            y2={B.y + H / 2}
            stroke={active ? "#e2e8f0" : "#475569"}
            strokeWidth={active ? 2.5 : 1.5}
            className={active ? "flow" : ""}
            markerEnd="url(#arrow)"
          />
        );
      })}
      {/* vector store feeds retrieval; the same embedding model embeds the query */}
      <path d={`M ${byId.vec.x + W / 2} ${byId.vec.y + H} C 895 190, 560 180, ${byId.retrieve.x + W - 20} ${byId.retrieve.y - 4}`} fill="none" stroke={on("vec") && on("retrieve") ? "#67e8f9" : "#475569"} strokeWidth="2" className={on("vec") && on("retrieve") ? "flow" : ""} markerEnd="url(#arrow)" />
      <path d={`M ${byId.embed.x + 40} ${byId.embed.y + H} C 640 170, 520 190, ${byId.retrieve.x + 60} ${byId.retrieve.y - 4}`} fill="none" stroke={on("embed") && on("retrieve") ? "#d8b4fe" : "#334155"} strokeWidth="1.5" strokeDasharray="5 5" markerEnd="url(#arrow)" />
      <text x="640" y="200" fill="#c4b5fd" fontSize="11">embed query</text>
      <text x="840" y="190" fill="#67e8f9" fontSize="11">k-NN search</text>

      {NODES.map((n) => {
        const active = on(n.id);
        return (
          <g key={n.id} opacity={active ? 1 : 0.35} className="transition-opacity">
            <rect x={n.x} y={n.y} width={W} height={H} rx="16" fill={`url(#g-${n.id})`} className={active ? "node-glow" : ""} />
            <rect x={n.x + 2} y={n.y + 2} width={W - 4} height={H - 4} rx="14" fill="#0b1020" fillOpacity="0.55" />
            <text x={n.x + 14} y={n.y + 32} fontSize="20">{n.icon}</text>
            <text x={n.x + 44} y={n.y + 30} fill="#fff" fontSize="14" fontWeight="700">{n.title}</text>
            <text x={n.x + 44} y={n.y + 50} fill="#cbd5e1" fontSize="11">{n.id === "vec" && vectorStore ? vectorStore : n.sub}</text>
          </g>
        );
      })}
    </svg>
  );
}
