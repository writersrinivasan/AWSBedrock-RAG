export type StepMeta = {
  n: number;
  key: string;
  title: string;
  short: string;
  minutes: number;
  icon: string;
  gradient: string;
  summary: string;
};

// The 60-minute run of show. Each gradient string is a literal so Tailwind can see it.
export const STEPS: StepMeta[] = [
  { n: 1, key: "scenario", title: "The Industrial Scenario & Architecture", short: "Scenario", minutes: 6, icon: "🏭", gradient: "from-orange-400 to-pink-500", summary: "Why Helix Wind Energy needs RAG and the end-to-end Bedrock Knowledge Base architecture." },
  { n: 2, key: "access", title: "Enable Model Access & IAM", short: "Model access", minutes: 5, icon: "🔐", gradient: "from-amber-400 to-orange-500", summary: "Enable Titan Text Embeddings V2 and a generation model in Bedrock, and create the KB service role." },
  { n: 3, key: "s3", title: "Upload Source Documents to Amazon S3", short: "S3 upload", minutes: 5, icon: "🪣", gradient: "from-emerald-400 to-teal-500", summary: "Create the S3 bucket and upload manuals, SOPs, alarm guides, incident reports, parts and contracts." },
  { n: 4, key: "create-kb", title: "Create the Knowledge Base", short: "Create KB", minutes: 8, icon: "🧠", gradient: "from-sky-400 to-indigo-500", summary: "Choose the embeddings model, vector dimensions, vector store and chunking strategy." },
  { n: 5, key: "sync", title: "Sync: Parse → Chunk → Embed → Index", short: "Ingestion sync", minutes: 8, icon: "⚙️", gradient: "from-violet-400 to-fuchsia-500", summary: "Run StartIngestionJob and inspect the actual chunks and embedding vectors produced." },
  { n: 6, key: "retrieve", title: "Test the Retrieve API", short: "Retrieve", minutes: 6, icon: "🔎", gradient: "from-cyan-400 to-blue-500", summary: "Semantic vs hybrid search, top-K, metadata filters and similarity scores." },
  { n: 7, key: "rag", title: "RetrieveAndGenerate — Live RAG with LangGraph", short: "RAG live", minutes: 12, icon: "🚀", gradient: "from-pink-400 to-rose-500", summary: "Full RAG pipeline orchestrated by LangGraph with Llama 3.3 70B via Groq, returning cited answers." },
  { n: 8, key: "guardrails", title: "Responsible AI with Bedrock Guardrails", short: "Guardrails", minutes: 5, icon: "🛡️", gradient: "from-lime-400 to-emerald-500", summary: "Denied topics, prompt-attack filter and PII masking on input and output." },
  { n: 9, key: "evaluate", title: "Evaluate Quality & Estimate Cost", short: "Evaluate & cost", minutes: 3, icon: "📊", gradient: "from-yellow-400 to-amber-500", summary: "Measure retrieval hit-rate / MRR on a golden set and estimate the monthly AWS bill." },
  { n: 10, key: "cleanup", title: "Clean Up & Go to Production", short: "Clean up", minutes: 2, icon: "🧹", gradient: "from-rose-400 to-red-500", summary: "Delete resources to stop charges and review the production checklist." },
];
