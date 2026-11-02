# Bedrock RAG Lab

A colourful, hands-on sandbox that teaches **Retrieval-Augmented Generation on Amazon Bedrock Knowledge Bases**, with no AWS account or credits needed.
Orchestration uses **LangGraph**. Generation uses **your own Groq API key (BYOK)** and runs **Llama 3.3 70B**, the same open model family as `meta.llama3-3-70b-instruct-v1:0` on Bedrock.

**Industrial scenario:** *Helix Wind Energy* (fictional) runs 420 HX-3000 wind turbines. Field technicians ask questions and get cited answers from maintenance manuals, the LOTO safety SOP, SCADA alarm codes, an incident report, a spare-parts catalogue and warranty terms.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Paste a Groq key (free at https://console.groq.com/keys) in the header. The key is kept only in your browser's localStorage and is sent only to this app's own API routes, which forward it to Groq.
Without a key, steps 1–6 and 8–10 still work fully, and step 7 runs in an offline extractive mode, so the demo never dead-ends.

## The 60-minute run of show

| # | Step | Min | What the audience sees |
|---|------|-----|------------------------|
| 1 | Scenario & architecture | 6 | Business problem, animated architecture, RAG vs fine-tuning |
| 2 | Model access & IAM | 5 | Model access console, KB service-role policies, CLI/boto3 |
| 3 | Upload to S3 | 5 | Bucket + upload, document viewer, `.metadata.json` sidecars |
| 4 | Create Knowledge Base | 8 | Embeddings model, dimensions, vector store, chunking, live boto3 code |
| 5 | Ingestion sync | 8 | Parse → chunk → embed → index animation, chunk & vector explorer |
| 6 | Retrieve API | 6 | Semantic vs hybrid, top-K, metadata filters, raw JSON |
| 7 | RetrieveAndGenerate (live) | 12 | LangGraph trace node by node, cited answer, prompt, Bedrock JSON |
| 8 | Guardrails | 5 | Denied topics, prompt attacks, PII masking, attach to RAG |
| 9 | Evaluate & cost | 3 | Hit@1 / MRR golden set, chunking comparison, monthly cost estimator |
| 10 | Clean up | 2 | Ordered deletion, production checklist |

The sidebar has a session clock that tells you whether you are behind schedule. The **🤖 Bedrock Coach** (bottom right) is a LangGraph + Groq assistant that knows which step you're on.

**Good live demos:** in step 7, click the *guardrail test* (blocked before retrieval) and the *out-of-domain test* (→ `no_answer`). In step 4, change the chunk size to 40 tokens, re-sync, and compare in step 9.

## What is real and what is simulated

| Bedrock component | In this lab |
|---|---|
| S3 data source | 6 bundled documents (`src/lib/corpus.ts`) |
| Chunking (fixed / semantic / none) | Same algorithms, run live (`src/lib/rag.ts`) |
| Titan Text Embeddings V2 | Deterministic hashed TF-IDF embeddings, 256/512/1024-d |
| OpenSearch Serverless k-NN | In-memory cosine search, plus a hybrid keyword score |
| RetrieveAndGenerate | LangGraph graph (`src/lib/graph.ts`), real LLM via Groq |
| Guardrails | Rule-based emulation of topic / content / prompt-attack / PII policies |
| API responses | Real `bedrock-agent-runtime` JSON shapes |

All the boto3 / CLI snippets shown are the real calls to use on AWS. Prices in step 9 are approximate, so check the AWS pricing pages before quoting them.

## Layout

```
src/lib/corpus.ts       industrial documents + metadata
src/lib/rag.ts          chunk → embed → index → retrieve (isomorphic)
src/lib/guardrails.ts   Bedrock Guardrails emulation
src/lib/graph.ts        LangGraph RAG graph + Bedrock-shaped citations
src/app/api/rag         streams one NDJSON event per graph node
src/app/api/assistant   Bedrock Coach (LangGraph MessagesAnnotation graph)
src/app/api/models      validates the BYOK key, lists Groq models
src/components/steps/   the 10 workshop screens
```
