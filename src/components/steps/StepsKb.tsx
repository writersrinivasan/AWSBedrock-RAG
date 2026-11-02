"use client";

import { useMemo, useState } from "react";
import { BUCKET, DOCUMENTS } from "@/lib/corpus";
import { embedQuery, retrieve, toBedrockRetrieveResponse, type KbConfig, type SearchType } from "@/lib/rag";
import { ArchitectureDiagram, STEP_HIGHLIGHT } from "../ArchitectureDiagram";
import { useWorkshop } from "../workshop";
import { Badge, Btn, Callout, Card, CodeTabs, ConsoleFrame, Field, JsonView, Spinner, inputCls } from "../ui";
import { fakeId, NeedSync, RealAws, sleep, StepShell, VectorStrip } from "./common";

const STORE_LABEL: Record<KbConfig["vectorStore"], string> = {
  OPENSEARCH_SERVERLESS: "OpenSearch Serverless",
  S3_VECTORS: "Amazon S3 Vectors",
  AURORA_PGVECTOR: "Aurora PostgreSQL pgvector",
};

const GEN_MODELS = [
  ["meta.llama3-3-70b-instruct-v1:0", "Llama 3.3 70B Instruct (→ Groq, same model family)"],
  ["anthropic.claude-sonnet-4", "Claude Sonnet (→ emulated by your Groq model)"],
  ["amazon.nova-pro-v1:0", "Amazon Nova Pro (→ emulated by your Groq model)"],
];

/* ------------------------------ Step 4 ------------------------------ */

export function Step4() {
  const { kbConfig, setKbConfig, kbId, setKbId } = useWorkshop();
  const [busy, setBusy] = useState<string | null>(null);
  const [resp, setResp] = useState<unknown>(null);
  const set = <K extends keyof KbConfig>(k: K, v: KbConfig[K]) => setKbConfig({ ...kbConfig, [k]: v });

  const create = async () => {
    const id = fakeId();
    for (const s of ["Validating IAM service role…", `Creating ${STORE_LABEL[kbConfig.vectorStore]} vector index…`, "Creating knowledge base…", "Attaching S3 data source…"]) {
      setBusy(s);
      await sleep(650);
    }
    setBusy(null);
    setKbId(id);
    setResp({
      knowledgeBase: {
        knowledgeBaseId: id,
        name: kbConfig.name,
        knowledgeBaseArn: `arn:aws:bedrock:us-east-1:123456789012:knowledge-base/${id}`,
        roleArn: "arn:aws:iam::123456789012:role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_helix",
        knowledgeBaseConfiguration: {
          type: "VECTOR",
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: `arn:aws:bedrock:us-east-1::foundation-model/${kbConfig.embeddingModel}`,
            embeddingModelConfiguration: { bedrockEmbeddingModelConfiguration: { dimensions: kbConfig.dimensions, embeddingDataType: "FLOAT32" } },
          },
        },
        storageConfiguration: { type: kbConfig.vectorStore === "AURORA_PGVECTOR" ? "RDS" : kbConfig.vectorStore },
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
      },
      dataSource: { dataSourceId: fakeId(), status: "AVAILABLE", s3: `arn:aws:s3:::${BUCKET}` },
    });
  };

  const chunkingJson =
    kbConfig.chunking === "FIXED_SIZE"
      ? `{"chunkingStrategy": "FIXED_SIZE",
             "fixedSizeChunkingConfiguration": {"maxTokens": ${kbConfig.maxTokens}, "overlapPercentage": ${kbConfig.overlapPercentage}}}`
      : kbConfig.chunking === "SEMANTIC"
        ? `{"chunkingStrategy": "SEMANTIC",
             "semanticChunkingConfiguration": {"maxTokens": ${kbConfig.maxTokens}, "bufferSize": 0, "breakpointPercentileThreshold": 95}}`
        : `{"chunkingStrategy": "NONE"}`;

  const storage =
    kbConfig.vectorStore === "OPENSEARCH_SERVERLESS"
      ? `{"type": "OPENSEARCH_SERVERLESS",
        "opensearchServerlessConfiguration": {
            "collectionArn": "arn:aws:aoss:us-east-1:123456789012:collection/helixkb",
            "vectorIndexName": "helix-kb-index",
            "fieldMapping": {"vectorField": "embedding", "textField": "AMAZON_BEDROCK_TEXT_CHUNK", "metadataField": "AMAZON_BEDROCK_METADATA"}}}`
      : kbConfig.vectorStore === "S3_VECTORS"
        ? `{"type": "S3_VECTORS",
        "s3VectorsConfiguration": {"vectorBucketArn": "arn:aws:s3vectors:us-east-1:123456789012:bucket/helix-vectors", "indexName": "helix-kb-index"}}`
        : `{"type": "RDS",
        "rdsConfiguration": {
            "resourceArn": "arn:aws:rds:us-east-1:123456789012:cluster:helix-kb",
            "credentialsSecretArn": "arn:aws:secretsmanager:us-east-1:123456789012:secret:helix-kb",
            "databaseName": "kb", "tableName": "bedrock_integration.bedrock_kb",
            "fieldMapping": {"primaryKeyField": "id", "vectorField": "embedding", "textField": "chunks", "metadataField": "metadata"}}}`;

  return (
    <StepShell n={4} canComplete={!!kbId} blocker="Click “Create knowledge base” first">
      <ArchitectureDiagram highlight={STEP_HIGHLIGHT[4]} vectorStore={STORE_LABEL[kbConfig.vectorStore]} />
      <ConsoleFrame crumbs={["Amazon Bedrock", "Knowledge Bases", "Create knowledge base with vector store"]}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Knowledge base name">
            <input className={inputCls} value={kbConfig.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Data source" hint="Amazon S3 · the bucket from step 3">
            <input className={`${inputCls} font-mono text-xs`} value={`s3://${BUCKET}/`} readOnly />
          </Field>
          <Field label="Embeddings model">
            <select className={inputCls} value={kbConfig.embeddingModel} onChange={(e) => set("embeddingModel", e.target.value)}>
              <option value="amazon.titan-embed-text-v2:0">Titan Text Embeddings V2</option>
              <option value="cohere.embed-english-v3">Cohere Embed English v3</option>
            </select>
          </Field>
          <Field label="Vector dimensions" hint="Smaller = cheaper storage and faster search, slightly lower accuracy">
            <div className="flex gap-2">
              {([256, 512, 1024] as const).map((d) => (
                <button key={d} onClick={() => set("dimensions", d)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ring-1 ${kbConfig.dimensions === d ? "bg-sky-500/30 text-white ring-sky-400" : "bg-white/5 text-slate-300 ring-white/10"}`}>
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Vector store">
            <div className="space-y-1.5">
              {(Object.keys(STORE_LABEL) as KbConfig["vectorStore"][]).map((v) => (
                <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${kbConfig.vectorStore === v ? "bg-cyan-500/20 ring-cyan-400" : "bg-white/5 ring-white/10"}`}>
                  <input type="radio" className="accent-cyan-400" checked={kbConfig.vectorStore === v} onChange={() => set("vectorStore", v)} />
                  <span className="text-white">{STORE_LABEL[v]}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {v === "OPENSEARCH_SERVERLESS" ? "quick-create, hybrid search" : v === "S3_VECTORS" ? "lowest cost" : "SQL + vectors"}
                  </span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Chunking strategy">
            <div className="space-y-1.5">
              {(
                [
                  ["FIXED_SIZE", "Fixed-size", "N tokens with overlap (default 300 / 20%)"],
                  ["SEMANTIC", "Semantic", "split where the topic changes"],
                  ["NONE", "No chunking", "one chunk per file"],
                ] as const
              ).map(([v, l, d]) => (
                <label key={v} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${kbConfig.chunking === v ? "bg-violet-500/20 ring-violet-400" : "bg-white/5 ring-white/10"}`}>
                  <input type="radio" className="accent-violet-400" checked={kbConfig.chunking === v} onChange={() => set("chunking", v)} />
                  <span className="text-white">{l}</span>
                  <span className="ml-auto text-xs text-slate-400">{d}</span>
                </label>
              ))}
            </div>
          </Field>
          {kbConfig.chunking !== "NONE" && (
            <Field label={`Max tokens per chunk: ${kbConfig.maxTokens}`}>
              <input type="range" min={40} max={300} step={10} value={kbConfig.maxTokens} onChange={(e) => set("maxTokens", Number(e.target.value))} className="w-full accent-pink-500" />
            </Field>
          )}
          {kbConfig.chunking === "FIXED_SIZE" && (
            <Field label={`Overlap: ${kbConfig.overlapPercentage}%`}>
              <input type="range" min={0} max={50} step={5} value={kbConfig.overlapPercentage} onChange={(e) => set("overlapPercentage", Number(e.target.value))} className="w-full accent-pink-500" />
            </Field>
          )}
          <Field label="Generation model (used in step 7)">
            <select className={inputCls} value={kbConfig.generationModel} onChange={(e) => set("generationModel", e.target.value)}>
              {GEN_MODELS.map(([id, l]) => (
                <option key={id} value={id}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {busy && (
            <span className="flex items-center gap-2 text-sm text-sky-300">
              <Spinner /> {busy}
            </span>
          )}
          {kbId && !busy && <Badge color="green">● ACTIVE · {kbId}</Badge>}
          <Btn onClick={create} disabled={!!busy}>
            🧠 {kbId ? "Re-create knowledge base" : "Create knowledge base"}
          </Btn>
        </div>
      </ConsoleFrame>

      <CodeTabs
        tabs={[
          {
            label: "Python (boto3) — live from your settings",
            code: `import boto3
agent = boto3.client("bedrock-agent", region_name="us-east-1")

kb = agent.create_knowledge_base(
    name="${kbConfig.name}",
    roleArn="arn:aws:iam::123456789012:role/service-role/AmazonBedrockExecutionRoleForKnowledgeBase_helix",
    knowledgeBaseConfiguration={
        "type": "VECTOR",
        "vectorKnowledgeBaseConfiguration": {
            "embeddingModelArn": "arn:aws:bedrock:us-east-1::foundation-model/${kbConfig.embeddingModel}",
            "embeddingModelConfiguration": {
                "bedrockEmbeddingModelConfiguration": {"dimensions": ${kbConfig.dimensions}}
            },
        },
    },
    storageConfiguration=${storage},
)
kb_id = kb["knowledgeBase"]["knowledgeBaseId"]

ds = agent.create_data_source(
    knowledgeBaseId=kb_id,
    name="helix-s3-docs",
    dataSourceConfiguration={"type": "S3", "s3Configuration": {"bucketArn": "arn:aws:s3:::${BUCKET}"}},
    vectorIngestionConfiguration={
        "chunkingConfiguration": ${chunkingJson}
    },
)
print(kb_id, ds["dataSource"]["dataSourceId"])`,
          },
        ]}
      />
      {resp !== null && <JsonView title="create_knowledge_base → response" data={resp} />}

      <RealAws>
        With the console&apos;s <b>Quick create</b> option, Bedrock provisions an OpenSearch Serverless collection and vector index for you — that collection bills per OCU-hour even when idle, which is the #1 surprise cost
        (see step 9). <b>S3 Vectors</b> is the low-cost alternative for workloads that don&apos;t need hybrid search. Chunking cannot be changed after the data source is created — you create a new data source instead.
      </RealAws>
    </StepShell>
  );
}

/* ------------------------------ Step 5 ------------------------------ */

const STAGES = ["Parse", "Chunk", "Embed", "Index"] as const;

export function Step5() {
  const { kbId, index, kbConfig, synced, setSynced } = useWorkshop();
  const [prog, setProg] = useState<Record<string, number>>({});
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setSynced(false);
    setJobId(fakeId());
    setProg({});
    for (const d of DOCUMENTS) {
      for (let s = 1; s <= STAGES.length; s++) {
        setProg((p) => ({ ...p, [d.id]: s }));
        await sleep(160);
      }
    }
    setRunning(false);
    setSynced(true);
    setSelected(index.chunks[0]?.id ?? null);
  };

  const chunk = index.chunks.find((c) => c.id === selected);
  const maxTok = Math.max(...index.chunks.map((c) => c.tokens));

  if (!kbId)
    return (
      <StepShell n={5} canComplete={false} blocker="Create the knowledge base in step 4">
        <NeedSync />
      </StepShell>
    );

  return (
    <StepShell n={5} canComplete={synced} blocker="Run the sync to index your documents">
      <ConsoleFrame crumbs={["Amazon Bedrock", "Knowledge Bases", kbConfig.name, "Data source: helix-s3-docs"]}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-slate-300">
            Chunking <Badge color="violet">{kbConfig.chunking}</Badge> {kbConfig.chunking !== "NONE" && <Badge color="pink">{kbConfig.maxTokens} tokens</Badge>}{" "}
            {kbConfig.chunking === "FIXED_SIZE" && <Badge color="pink">{kbConfig.overlapPercentage}% overlap</Badge>} <Badge color="blue">{kbConfig.dimensions}-d</Badge>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {synced && <Badge color="green">● Sync COMPLETE · job {jobId}</Badge>}
            <Btn onClick={run} disabled={running}>
              {running ? <Spinner /> : "🔄"} {synced ? "Sync again" : "Sync"}
            </Btn>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {DOCUMENTS.map((d) => (
            <div key={d.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs md:grid-cols-[260px_1fr]">
              <span className="truncate font-mono text-sky-300">{d.fileName.split("/").pop()}</span>
              <div className="grid grid-cols-4 gap-1">
                {STAGES.map((s, i) => (
                  <div
                    key={s}
                    className={`rounded-md py-1 text-center font-semibold transition-all ${
                      (prog[d.id] ?? 0) > i ? ["bg-orange-500/70", "bg-pink-500/70", "bg-violet-500/70", "bg-cyan-500/70"][i] + " text-white" : "bg-white/5 text-slate-500"
                    }`}
                  >
                    {s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ConsoleFrame>

      {synced && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Documents scanned", index.stats.documents],
              ["Chunks indexed", index.stats.chunks],
              ["Avg tokens / chunk", index.stats.avgTokens],
              ["Embedding tokens", index.stats.tokens.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="glass rounded-2xl p-4">
                <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
                <div className="mt-1 text-3xl font-black text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card title="Chunk explorer" icon="✂️" className="lg:col-span-2">
              <div className="max-h-[460px] space-y-1 overflow-y-auto pr-1">
                {index.chunks.map((c) => (
                  <button key={c.id} onClick={() => setSelected(c.id)} className={`w-full rounded-lg px-3 py-2 text-left text-xs ring-1 transition ${selected === c.id ? "bg-violet-500/20 ring-violet-400" : "bg-white/[0.03] ring-white/5 hover:bg-white/5"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-violet-300">{c.id}</span>
                      <span className="text-slate-400">{c.tokens} tok</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-white/10">
                      <div className="h-1 rounded-full bg-gradient-to-r from-pink-500 to-violet-500" style={{ width: `${(c.tokens / maxTok) * 100}%` }} />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
            {chunk && (
              <Card title={chunk.id} icon="🧬" className="lg:col-span-3" right={<Badge color="blue">{chunk.tokens} tokens</Badge>}>
                <div className="mb-3 text-xs text-slate-400">{chunk.title}</div>
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 text-sm leading-relaxed text-slate-200">{chunk.text}</div>
                <div className="mt-4 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Embedding vector (first 64 of {chunk.vector.length} dims) <span className="text-pink-400">■ +</span> <span className="text-cyan-400">■ −</span>
                </div>
                <VectorStrip vector={chunk.vector} />
                <div className="mt-2 font-mono text-[11px] text-slate-500">[{chunk.vector.slice(0, 6).map((v) => v.toFixed(4)).join(", ")}, …]</div>
                <div className="mt-4">
                  <JsonView title="vector store document" maxH="max-h-48" data={{ AMAZON_BEDROCK_TEXT_CHUNK: chunk.text.slice(0, 80) + "…", AMAZON_BEDROCK_METADATA: chunk.metadata, embedding: `[${chunk.vector.length} floats]` }} />
                </div>
              </Card>
            )}
          </div>

          <JsonView
            title="get_ingestion_job → response"
            data={{
              ingestionJob: {
                ingestionJobId: jobId,
                knowledgeBaseId: kbId,
                dataSourceId: "helix-s3-docs",
                status: "COMPLETE",
                statistics: {
                  numberOfDocumentsScanned: index.stats.documents,
                  numberOfMetadataDocumentsScanned: index.stats.documents,
                  numberOfNewDocumentsIndexed: index.stats.documents,
                  numberOfModifiedDocumentsIndexed: 0,
                  numberOfDocumentsDeleted: 0,
                  numberOfDocumentsFailed: 0,
                },
              },
            }}
          />
          <Callout kind="tip" title="Live experiment for the audience">
            Go back to step 4, change max tokens from {kbConfig.maxTokens} to 40 or 300 (or switch to Semantic), re-sync, and watch the chunk count and the retrieval quality in steps 6 and 9 change.
          </Callout>
        </>
      )}

      <CodeTabs
        tabs={[
          {
            label: "Python (boto3)",
            code: `import time
job = agent.start_ingestion_job(knowledgeBaseId=kb_id, dataSourceId=ds_id)["ingestionJob"]

while job["status"] not in ("COMPLETE", "FAILED", "STOPPED"):
    time.sleep(5)
    job = agent.get_ingestion_job(knowledgeBaseId=kb_id, dataSourceId=ds_id,
                                  ingestionJobId=job["ingestionJobId"])["ingestionJob"]
print(job["status"], job["statistics"])`,
          },
          { label: "AWS CLI", code: `aws bedrock-agent start-ingestion-job --knowledge-base-id ${kbId} --data-source-id <DS_ID>\naws bedrock-agent list-ingestion-jobs --knowledge-base-id ${kbId} --data-source-id <DS_ID>` },
        ]}
      />
      <RealAws>
        Syncs are incremental: only new, modified or deleted S3 objects are re-processed. You pay for the embedding tokens (Titan V2 ≈ $0.00002 / 1K tokens — this whole library ≈ {index.stats.tokens.toLocaleString()} tokens ≈ a
        fraction of a cent) plus the vector store. Schedule syncs with EventBridge or trigger them from an S3 event.
      </RealAws>
    </StepShell>
  );
}

/* ------------------------------ Step 6 ------------------------------ */

const SAMPLE_QUERIES = [
  "What is the vibration alarm limit for the generator bearing?",
  "Torque value for blade root bolts",
  "Can I climb the tower when it is windy?",
  "Why did T-14 at Kestrel Ridge fail?",
  "How long does a pitch motor take to arrive?",
];

export function Step6() {
  const { index, synced, kbId } = useWorkshop();
  const [q, setQ] = useState(SAMPLE_QUERIES[0]);
  const [k, setK] = useState(4);
  const [searchType, setSearchType] = useState<SearchType>("SEMANTIC");
  const [filter, setFilter] = useState("");
  const [submitted, setSubmitted] = useState(SAMPLE_QUERIES[0]);
  const [showRaw, setShowRaw] = useState(false);

  const filterObj = filter ? { key: "doc_type", value: filter } : null;
  const results = useMemo(() => (synced ? retrieve(index, submitted, { numberOfResults: k, searchType, filter: filterObj }) : []), [index, submitted, k, searchType, filter, synced]); // eslint-disable-line react-hooks/exhaustive-deps
  const qv = useMemo(() => embedQuery(index, submitted), [index, submitted]);

  if (!synced)
    return (
      <StepShell n={6} canComplete={false} blocker="Sync the knowledge base first">
        <NeedSync />
      </StepShell>
    );

  const filterCode = filterObj ? `,\n            "filter": {"equals": {"key": "doc_type", "value": "${filter}"}}` : "";

  return (
    <StepShell n={6}>
      <ConsoleFrame crumbs={["Amazon Bedrock", "Knowledge Bases", "Test knowledge base", "Retrieval only"]}>
        <form
          className="flex flex-col gap-3 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q);
          }}
        >
          <input className={`${inputCls} flex-1`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the knowledge base…" />
          <Btn type="submit">🔎 Retrieve</Btn>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SAMPLE_QUERIES.map((s) => (
            <button key={s} onClick={() => { setQ(s); setSubmitted(s); }} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-white/10 hover:bg-white/10">
              {s}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label={`Number of results (top-K): ${k}`}>
            <input type="range" min={1} max={8} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full accent-cyan-400" />
          </Field>
          <Field label="Search type">
            <div className="flex gap-2">
              {(["SEMANTIC", "HYBRID"] as const).map((t) => (
                <button key={t} onClick={() => setSearchType(t)} className={`flex-1 rounded-lg py-2 text-xs font-semibold ring-1 ${searchType === t ? "bg-cyan-500/30 text-white ring-cyan-400" : "bg-white/5 text-slate-300 ring-white/10"}`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Metadata filter (doc_type)">
            <select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">— none —</option>
              {[...new Set(DOCUMENTS.map((d) => d.metadata.doc_type))].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </ConsoleFrame>

      <Card title="Query embedding" icon="🧬" right={<Badge color="violet">{qv.length}-d · same model as the chunks</Badge>}>
        <VectorStrip vector={qv} />
        <p className="mt-2 text-xs text-slate-400">The question is embedded, then the vector store returns the chunks with the highest cosine similarity{searchType === "HYBRID" ? " blended with a keyword (BM25-style) score" : ""}.</p>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Top {results.length} chunks</h3>
        <Btn variant="ghost" onClick={() => setShowRaw(!showRaw)}>
          {showRaw ? "Show cards" : "Show raw API JSON"}
        </Btn>
      </div>
      {showRaw ? (
        <JsonView title="bedrock-agent-runtime retrieve → response" data={toBedrockRetrieveResponse(results)} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((r, i) => (
            <div key={r.chunkId} className="glass rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-black text-white">{i + 1}</span>
                <span className="truncate text-sm font-semibold text-white">{r.title}</span>
              </div>
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="w-16 text-slate-400">score</span>
                <div className="h-2 flex-1 rounded-full bg-white/10">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-pink-500" style={{ width: `${Math.min(100, r.score * 100)}%` }} />
                </div>
                <span className="w-12 text-right font-mono text-cyan-300">{r.score.toFixed(3)}</span>
              </div>
              {searchType === "HYBRID" && (
                <div className="mb-2 flex gap-3 font-mono text-[11px] text-slate-400">
                  <span>semantic {r.semanticScore.toFixed(3)}</span>
                  <span>keyword {r.keywordScore.toFixed(3)}</span>
                </div>
              )}
              <p className="line-clamp-5 text-sm leading-relaxed text-slate-300">{r.text}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge color="blue">{r.metadata.doc_type}</Badge>
                <span className="truncate font-mono text-[10px] text-slate-500">{r.uri}</span>
              </div>
            </div>
          ))}
          {results.length === 0 && <Callout kind="warn">No chunks match this filter.</Callout>}
        </div>
      )}

      <CodeTabs
        tabs={[
          {
            label: "Python (boto3) — live from your settings",
            code: `rt = boto3.client("bedrock-agent-runtime", region_name="us-east-1")

resp = rt.retrieve(
    knowledgeBaseId="${kbId}",
    retrievalQuery={"text": ${JSON.stringify(submitted)}},
    retrievalConfiguration={
        "vectorSearchConfiguration": {
            "numberOfResults": ${k},
            "overrideSearchType": "${searchType}"${filterCode}
        }
    },
)
for r in resp["retrievalResults"]:
    print(round(r["score"], 3), r["location"]["s3Location"]["uri"])`,
          },
        ]}
      />
      <RealAws>
        <code>Retrieve</code> returns chunks only — no LLM is called, so it is cheap and great for building your own prompts (exactly what our LangGraph app does in step 7). Hybrid search is available with OpenSearch
        Serverless and Aurora; for higher precision add a <b>reranker</b> (Amazon Rerank / Cohere Rerank) on top of a larger top-K.
      </RealAws>
    </StepShell>
  );
}
