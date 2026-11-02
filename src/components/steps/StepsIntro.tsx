"use client";

import { useState } from "react";
import { BUCKET, DOCUMENTS, s3Uri } from "@/lib/corpus";
import { ArchitectureDiagram } from "../ArchitectureDiagram";
import { Badge, Btn, Callout, Card, CodeTabs, ConsoleFrame, JsonView, Spinner } from "../ui";
import { RealAws, sleep, StepShell } from "./common";

/* ------------------------------ Step 1 ------------------------------ */

export function Step1() {
  return (
    <StepShell n={1}>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["420", "HX-3000 wind turbines across 9 wind farms", "from-orange-500/30 to-pink-500/20"],
          ["35 min", "average time a technician spends searching manuals per fault", "from-sky-500/30 to-indigo-500/20"],
          ["97%", "contractual availability that downtime puts at risk", "from-emerald-500/30 to-teal-500/20"],
          ["< 30 s", "target: cited answer on a phone, up the tower", "from-fuchsia-500/30 to-violet-500/20"],
        ].map(([k, v, g]) => (
          <div key={k} className={`rounded-2xl bg-gradient-to-br ${g} p-5 ring-1 ring-white/10`}>
            <div className="text-3xl font-black text-white">{k}</div>
            <div className="mt-1 text-sm text-slate-200">{v}</div>
          </div>
        ))}
      </div>

      <Card title="The business problem — Helix Wind Energy (fictional)" icon="🏭">
        <p className="text-slate-300">
          A turbine stops at 2 a.m. on alarm <b className="text-orange-300">E-518 generator bearing vibration high</b>. The technician must combine the alarm guide, the maintenance manual vibration thresholds, last
          year&apos;s incident report, the LOTO safety SOP before climbing, spare-part stock, and the warranty response-time clause. That knowledge is spread over thousands of pages. A plain LLM does
          not know any of it and will confidently invent torque values. <b className="text-white">RAG</b> fixes this by retrieving the right passages first and making the model answer only from them, with citations.
        </p>
      </Card>

      <Card title="Reference architecture: Amazon Bedrock Knowledge Bases" icon="🗺️">
        <ArchitectureDiagram />
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <Callout kind="info" title="Ingestion (steps 3–5)">
            Documents land in <b>S3</b>. A Knowledge Base <b>sync</b> parses them, splits them into chunks, turns each chunk into a vector with <b>Titan Text Embeddings V2</b> and writes it to a vector store.
          </Callout>
          <Callout kind="tip" title="Query time (steps 6–8)">
            The question is embedded with the same model, the nearest chunks are retrieved, and a foundation model writes an answer grounded in them. <b>Guardrails</b> screen both input and output.
          </Callout>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Why RAG and not fine-tuning?" icon="⚖️">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1"></th>
                <th>RAG</th>
                <th>Fine-tuning</th>
              </tr>
            </thead>
            <tbody className="text-slate-300 [&_td]:py-1.5">
              <tr><td className="text-slate-400">Fresh data</td><td>✅ re-sync in minutes</td><td>❌ retrain</td></tr>
              <tr><td className="text-slate-400">Citations</td><td>✅ S3 source per sentence</td><td>❌ none</td></tr>
              <tr><td className="text-slate-400">Hallucination</td><td>✅ grounded</td><td>⚠️ still possible</td></tr>
              <tr><td className="text-slate-400">Access control</td><td>✅ metadata filters</td><td>❌ baked in</td></tr>
              <tr><td className="text-slate-400">Cost to start</td><td>✅ low</td><td>⚠️ training jobs</td></tr>
            </tbody>
          </table>
        </Card>
        <Card title="How this sandbox maps to AWS" icon="🧪">
          <ul className="space-y-2 text-sm text-slate-300">
            <li>🪣 <b>S3 bucket</b> → 6 real industrial documents bundled in the app</li>
            <li>✂️ <b>Chunking</b> → the same fixed-size / semantic algorithms, run live</li>
            <li>🧬 <b>Titan Embed V2</b> → deterministic hashed embeddings (256/512/1024-d)</li>
            <li>🗄️ <b>Vector store</b> → in-memory cosine k-NN + optional hybrid keyword score</li>
            <li>✨ <b>Llama 3.3 70B on Bedrock</b> → the same open model served by <b>Groq</b> (your key)</li>
            <li>🕸️ <b>RetrieveAndGenerate</b> → a <b>LangGraph</b> graph whose nodes you can watch</li>
            <li>📦 All responses use the real <b>bedrock-agent-runtime</b> JSON shapes</li>
          </ul>
        </Card>
      </div>
    </StepShell>
  );
}

/* ------------------------------ Step 2 ------------------------------ */

const MODELS = [
  { id: "amazon.titan-embed-text-v2:0", name: "Titan Text Embeddings V2", provider: "Amazon", use: "Embeddings", required: true },
  { id: "meta.llama3-3-70b-instruct-v1:0", name: "Llama 3.3 70B Instruct", provider: "Meta", use: "Text generation", required: true },
  { id: "anthropic.claude-sonnet-4", name: "Claude Sonnet", provider: "Anthropic", use: "Text generation", required: false },
  { id: "amazon.nova-pro-v1:0", name: "Nova Pro", provider: "Amazon", use: "Text generation", required: false },
  { id: "cohere.rerank-v3-5:0", name: "Rerank 3.5", provider: "Cohere", use: "Reranking", required: false },
];

const ROLE_TRUST = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "bedrock.amazonaws.com" },
      Action: "sts:AssumeRole",
      Condition: { StringEquals: { "aws:SourceAccount": "123456789012" }, ArnLike: { "aws:SourceArn": "arn:aws:bedrock:us-east-1:123456789012:knowledge-base/*" } },
    },
  ],
};

const ROLE_POLICY = {
  Version: "2012-10-17",
  Statement: [
    { Sid: "InvokeEmbeddingModel", Effect: "Allow", Action: ["bedrock:InvokeModel"], Resource: ["arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"] },
    { Sid: "ReadSourceBucket", Effect: "Allow", Action: ["s3:GetObject", "s3:ListBucket"], Resource: [`arn:aws:s3:::${BUCKET}`, `arn:aws:s3:::${BUCKET}/*`] },
    { Sid: "WriteVectorIndex", Effect: "Allow", Action: ["aoss:APIAccessAll"], Resource: ["arn:aws:aoss:us-east-1:123456789012:collection/*"] },
  ],
};

export function Step2() {
  const [status, setStatus] = useState<Record<string, "none" | "pending" | "granted">>(Object.fromEntries(MODELS.map((m) => [m.id, "none"])));
  const [picked, setPicked] = useState<Set<string>>(new Set(MODELS.filter((m) => m.required).map((m) => m.id)));
  const [busy, setBusy] = useState(false);
  const ready = MODELS.filter((m) => m.required).every((m) => status[m.id] === "granted");

  const request = async () => {
    setBusy(true);
    for (const id of picked) {
      setStatus((s) => ({ ...s, [id]: "pending" }));
      await sleep(700);
      setStatus((s) => ({ ...s, [id]: "granted" }));
    }
    setBusy(false);
  };

  return (
    <StepShell n={2} canComplete={ready} blocker="Grant access to the two required models first">
      <ConsoleFrame crumbs={["Amazon Bedrock", "Model catalog", "Model access"]}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="w-8 py-2"></th>
              <th>Model</th>
              <th className="hidden md:table-cell">Model ID</th>
              <th>Used for</th>
              <th>Access</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((m) => (
              <tr key={m.id} className="border-t border-white/5">
                <td className="py-2.5">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={picked.has(m.id)}
                    onChange={(e) => {
                      const p = new Set(picked);
                      if (e.target.checked) p.add(m.id);
                      else p.delete(m.id);
                      setPicked(p);
                    }}
                  />
                </td>
                <td className="text-white">
                  {m.name} <span className="text-xs text-slate-500">· {m.provider}</span> {m.required && <Badge color="orange">required today</Badge>}
                </td>
                <td className="hidden font-mono text-xs text-slate-400 md:table-cell">{m.id}</td>
                <td className="text-slate-300">{m.use}</td>
                <td>
                  {status[m.id] === "granted" ? (
                    <Badge color="green">● Access granted</Badge>
                  ) : status[m.id] === "pending" ? (
                    <Badge color="blue">◌ In progress</Badge>
                  ) : (
                    <Badge>Available to request</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex justify-end">
          <Btn onClick={request} disabled={busy || picked.size === 0}>
            {busy ? <Spinner /> : "🔓"} Request model access
          </Btn>
        </div>
      </ConsoleFrame>

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonView title="AmazonBedrockExecutionRoleForKnowledgeBase · trust policy" data={ROLE_TRUST} />
        <JsonView title="AmazonBedrockExecutionRoleForKnowledgeBase · permissions" data={ROLE_POLICY} />
      </div>

      <CodeTabs
        tabs={[
          {
            label: "AWS CLI",
            code: `# Which embedding & text models can this account call?
aws bedrock list-foundation-models --region us-east-1 \\
  --query "modelSummaries[?contains(['amazon','meta'], providerName.toLowerCase(@))].[modelId,outputModalities[0]]" \\
  --output table

# Smoke-test the embedding model
aws bedrock-runtime invoke-model --region us-east-1 \\
  --model-id amazon.titan-embed-text-v2:0 \\
  --body '{"inputText":"generator bearing vibration","dimensions":1024,"normalize":true}' \\
  --cli-binary-format raw-in-base64-out out.json && jq '.embedding | length' out.json   # -> 1024`,
          },
          {
            label: "Python (boto3)",
            code: `import boto3, json
rt = boto3.client("bedrock-runtime", region_name="us-east-1")

resp = rt.invoke_model(
    modelId="amazon.titan-embed-text-v2:0",
    body=json.dumps({"inputText": "generator bearing vibration", "dimensions": 1024, "normalize": True}),
)
vec = json.loads(resp["body"].read())["embedding"]
print(len(vec), vec[:5])`,
          },
        ]}
      />

      <RealAws>
        Most serverless foundation models are now available by default in new accounts once your IAM principal has <code>bedrock:InvokeModel</code>; some providers (e.g. Anthropic) require a one-time use-case form.
        When you create a Knowledge Base in the console, Bedrock can create the service role above for you. Least-privilege tip: scope the S3 statement to the exact bucket and prefix.
      </RealAws>
    </StepShell>
  );
}

/* ------------------------------ Step 3 ------------------------------ */

export function Step3() {
  const [bucket, setBucket] = useState<"none" | "creating" | "ready">("none");
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState(DOCUMENTS[0].id);
  const uploaded = DOCUMENTS.every((d) => progress[d.id] === 100);
  const doc = DOCUMENTS.find((d) => d.id === preview)!;

  const create = async () => {
    setBucket("creating");
    await sleep(900);
    setBucket("ready");
  };
  const upload = async () => {
    for (const d of DOCUMENTS) {
      for (let p = 0; p <= 100; p += 20) {
        setProgress((s) => ({ ...s, [d.id]: p }));
        await sleep(60);
      }
    }
  };

  return (
    <StepShell n={3} canComplete={uploaded} blocker="Create the bucket and upload the documents">
      <ConsoleFrame crumbs={["Amazon S3", "Buckets", bucket === "ready" ? BUCKET : "Create bucket"]}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-mono text-sm text-white">s3://{BUCKET}</div>
          {bucket === "ready" ? <Badge color="green">● Created · us-east-1 · SSE-S3 · Block public access ON</Badge> : <Badge>not created</Badge>}
          <div className="ml-auto flex gap-2">
            <Btn variant="ghost" onClick={create} disabled={bucket !== "none"}>
              {bucket === "creating" ? <Spinner /> : "🪣"} Create bucket
            </Btn>
            <Btn onClick={upload} disabled={bucket !== "ready" || Object.keys(progress).length > 0}>
              ⬆️ Upload {DOCUMENTS.length} files
            </Btn>
          </div>
        </div>

        <div className="mt-4 divide-y divide-white/5">
          {DOCUMENTS.map((d) => (
            <button key={d.id} onClick={() => setPreview(d.id)} className={`flex w-full items-center gap-3 px-2 py-2 text-left text-sm hover:bg-white/5 ${preview === d.id ? "bg-white/5" : ""}`}>
              <span>{d.fileName.endsWith(".xlsx") ? "📗" : "📕"}</span>
              <span className="flex-1 truncate font-mono text-xs text-sky-300">{d.fileName}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">{d.sizeKb.toLocaleString()} KB</span>
              <span className="w-28">
                <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all" style={{ width: `${progress[d.id] ?? 0}%` }} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </ConsoleFrame>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card title={doc.title} icon="📄" className="lg:col-span-3" right={<Badge color="blue">{doc.metadata.doc_type}</Badge>}>
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap pr-2 text-sm leading-relaxed text-slate-300">{doc.text}</div>
        </Card>
        <div className="space-y-3 lg:col-span-2">
          <JsonView title={`${doc.fileName.split("/").pop()}.metadata.json`} data={{ metadataAttributes: doc.metadata }} />
          <Callout kind="tip" title="Metadata sidecar files">
            Put a <code>&lt;file&gt;.metadata.json</code> next to each object. Bedrock indexes these attributes so you can filter retrieval later — e.g. only <code>doc_type = sop</code> for a safety assistant.
          </Callout>
        </div>
      </div>

      <CodeTabs
        tabs={[
          {
            label: "AWS CLI",
            code: `aws s3 mb s3://${BUCKET} --region us-east-1
aws s3api put-public-access-block --bucket ${BUCKET} \\
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Upload the document library (manuals, SOPs, incidents, catalogue, contracts) + metadata sidecars
aws s3 cp ./helix-docs s3://${BUCKET}/ --recursive
aws s3 ls s3://${BUCKET}/ --recursive --human-readable`,
          },
          {
            label: "Python (boto3)",
            code: `import boto3, json, pathlib
s3 = boto3.client("s3", region_name="us-east-1")
s3.create_bucket(Bucket="${BUCKET}")

for path in pathlib.Path("helix-docs").rglob("*"):
    if path.is_file():
        key = str(path.relative_to("helix-docs"))
        s3.upload_file(str(path), "${BUCKET}", key)
        print("uploaded", f"s3://${BUCKET}/{key}")`,
          },
        ]}
      />

      <RealAws>
        Bedrock Knowledge Bases accept TXT, MD, HTML, DOC/DOCX, CSV, XLS/XLSX and PDF (up to 50 MB each). Besides S3 you can connect Confluence, SharePoint, Salesforce or a web crawler. Uploaded URIs look like{" "}
        <code className="break-all">{s3Uri(DOCUMENTS[0])}</code> — they come back as citations.
      </RealAws>
    </StepShell>
  );
}
