// A small, deterministic, dependency-free re-implementation of what a Bedrock Knowledge Base does:
// parse -> chunk -> embed -> index -> retrieve. It runs identically in the browser and on the server,
// so the audience sees real chunks, real vectors and real similarity scores without an AWS account.

import { DOCUMENTS, s3Uri, type KbDocument } from "./corpus";

export type ChunkingStrategy = "FIXED_SIZE" | "SEMANTIC" | "NONE";
export type SearchType = "SEMANTIC" | "HYBRID";

export type KbConfig = {
  name: string;
  embeddingModel: string;
  dimensions: 256 | 512 | 1024;
  vectorStore: "OPENSEARCH_SERVERLESS" | "S3_VECTORS" | "AURORA_PGVECTOR";
  chunking: ChunkingStrategy;
  maxTokens: number;
  overlapPercentage: number;
  generationModel: string;
};

export const DEFAULT_KB_CONFIG: KbConfig = {
  name: "helix-field-assistant-kb",
  embeddingModel: "amazon.titan-embed-text-v2:0",
  dimensions: 1024,
  vectorStore: "OPENSEARCH_SERVERLESS",
  chunking: "FIXED_SIZE",
  maxTokens: 120,
  overlapPercentage: 20,
  generationModel: "meta.llama3-3-70b-instruct-v1:0",
};

export type Chunk = {
  id: string;
  docId: string;
  title: string;
  uri: string;
  text: string;
  tokens: number;
  metadata: Record<string, string>;
  vector: number[];
  terms: string[];
};

export type KbIndex = {
  config: KbConfig;
  chunks: Chunk[];
  idf: Map<string, number>;
  defaultIdf: number;
  stats: { documents: number; chunks: number; tokens: number; avgTokens: number };
};

export type RetrievalResult = {
  chunkId: string;
  docId: string;
  title: string;
  uri: string;
  text: string;
  score: number;
  semanticScore: number;
  keywordScore: number;
  metadata: Record<string, string>;
};

const STOPWORDS = new Set(
  "a an the and or of to in on for is are was were be been by with as at from that this it its if than then must not no any all each every may can will into per when what which who how do does should my our your their there here about over under up out".split(
    " ",
  ),
);

// A tiny domain thesaurus stands in for the semantic knowledge a neural embedding model has.
const SYNONYMS: Record<string, string> = {
  shaking: "vibration", shake: "vibration", vibrat: "vibration", wobble: "vibration",
  hot: "temperature", heat: "temperature", overheat: "temperature", overheating: "temperature", temp: "temperature",
  lube: "lubrication", lubricat: "lubrication", grease: "lubrication", greasing: "lubrication",
  bolt: "torque", tighten: "torque", tightening: "torque",
  climb: "climbing", ladder: "climbing",
  wind: "wind", windy: "wind", gust: "wind",
  lockout: "loto", tagout: "loto", isolat: "loto", isolation: "loto",
  cost: "price", costs: "price", expensive: "price", usd: "price",
  delivery: "lead", wait: "lead",
  downtime: "availability", uptime: "availability",
  broke: "failure", broken: "failure", fail: "failure", failed: "failure",
  gear: "gearbox",
};

function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  const raw = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const out: string[] = [];
  for (const w of raw) {
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    const syn = SYNONYMS[w] ?? SYNONYMS[stem(w)];
    out.push(syn ?? stem(w));
  }
  return out;
}

export const estimateTokens = (text: string) => Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.33);

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function embedTerms(terms: string[], dim: number, idf?: Map<string, number>, defaultIdf = 1): number[] {
  const v = new Array<number>(dim).fill(0);
  const tf = new Map<string, number>();
  for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  for (let i = 0; i < terms.length - 1; i++) {
    const bg = `${terms[i]}_${terms[i + 1]}`;
    tf.set(bg, (tf.get(bg) ?? 0) + 0.5);
  }
  for (const [term, count] of tf) {
    let w = 1 + Math.log(count + 1);
    if (idf) {
      const parts = term.split("_");
      w *= parts.reduce((s, p) => s + (idf.get(p) ?? defaultIdf), 0) / parts.length;
    }
    const h = fnv1a(term);
    v[h % dim] += (h >>> 31) & 1 ? w : -w;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

const cosine = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

function chunkFixed(doc: KbDocument, maxTokens: number, overlapPct: number): string[] {
  const words = doc.text.split(/\s+/).filter(Boolean);
  const maxWords = Math.max(10, Math.floor(maxTokens / 1.33));
  const overlap = Math.floor((maxWords * overlapPct) / 100);
  const step = Math.max(1, maxWords - overlap);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += step) {
    out.push(words.slice(i, i + maxWords).join(" "));
    if (i + maxWords >= words.length) break;
  }
  return out;
}

// Semantic chunking: split into sentences/paragraphs, then start a new chunk wherever the
// similarity between neighbouring paragraphs drops (a topic shift) or the size budget is hit.
function chunkSemantic(doc: KbDocument, maxTokens: number): string[] {
  const paras = doc.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const vecs = paras.map((p) => embedTerms(tokenize(p), 256));
  const out: string[] = [];
  let cur: string[] = [];
  paras.forEach((p, i) => {
    const shift = i > 0 && cosine(vecs[i - 1], vecs[i]) < 0.12;
    const tooBig = estimateTokens([...cur, p].join("\n\n")) > maxTokens * 1.6;
    if (cur.length && (shift || tooBig)) {
      out.push(cur.join("\n\n"));
      cur = [];
    }
    cur.push(p);
  });
  if (cur.length) out.push(cur.join("\n\n"));
  return out;
}

const indexCache = new Map<string, KbIndex>();

export function buildIndex(config: KbConfig): KbIndex {
  const key = JSON.stringify([config.dimensions, config.chunking, config.maxTokens, config.overlapPercentage]);
  const cached = indexCache.get(key);
  if (cached) return { ...cached, config };

  const pieces: Omit<Chunk, "vector">[] = [];
  for (const doc of DOCUMENTS) {
    const texts =
      config.chunking === "NONE"
        ? [doc.text]
        : config.chunking === "SEMANTIC"
          ? chunkSemantic(doc, config.maxTokens)
          : chunkFixed(doc, config.maxTokens, config.overlapPercentage);
    texts.forEach((text, i) =>
      pieces.push({
        id: `${doc.id}-c${String(i + 1).padStart(2, "0")}`,
        docId: doc.id,
        title: doc.title,
        uri: s3Uri(doc),
        text,
        tokens: estimateTokens(text),
        metadata: { ...doc.metadata, "x-amz-bedrock-kb-source-uri": s3Uri(doc), "x-amz-bedrock-kb-chunk-id": `${doc.id}-c${i + 1}` },
        terms: tokenize(`${doc.title} ${text}`),
      }),
    );
  }

  const df = new Map<string, number>();
  for (const p of pieces) for (const t of new Set(p.terms)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = pieces.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + (n - d + 0.5) / (d + 0.5)));
  const defaultIdf = Math.log(1 + n);

  const chunks = pieces.map((p) => ({ ...p, vector: embedTerms(p.terms, config.dimensions, idf, defaultIdf) }));
  const tokens = chunks.reduce((s, c) => s + c.tokens, 0);
  const index: KbIndex = {
    config,
    chunks,
    idf,
    defaultIdf,
    stats: { documents: DOCUMENTS.length, chunks: chunks.length, tokens, avgTokens: Math.round(tokens / chunks.length) },
  };
  indexCache.set(key, index);
  return index;
}

export function embedQuery(index: KbIndex, query: string): number[] {
  return embedTerms(tokenize(query), index.config.dimensions, index.idf, index.defaultIdf);
}

export type RetrieveOptions = {
  numberOfResults?: number;
  searchType?: SearchType;
  filter?: { key: string; value: string } | null;
};

export function retrieve(index: KbIndex, query: string, opts: RetrieveOptions = {}): RetrievalResult[] {
  const { numberOfResults = 5, searchType = "SEMANTIC", filter = null } = opts;
  const qv = embedQuery(index, query);
  const qTerms = [...new Set(tokenize(query))];
  const qWeight = qTerms.reduce((s, t) => s + (index.idf.get(t) ?? index.defaultIdf), 0) || 1;

  return index.chunks
    .filter((c) => !filter || c.metadata[filter.key] === filter.value)
    .map((c) => {
      const semanticScore = Math.max(0, cosine(qv, c.vector));
      const termSet = new Set(c.terms);
      const keywordScore = qTerms.reduce((s, t) => s + (termSet.has(t) ? (index.idf.get(t) ?? index.defaultIdf) : 0), 0) / qWeight;
      const score = searchType === "HYBRID" ? 0.6 * semanticScore + 0.4 * keywordScore : semanticScore;
      return {
        chunkId: c.id,
        docId: c.docId,
        title: c.title,
        uri: c.uri,
        text: c.text,
        score: Number(score.toFixed(4)),
        semanticScore: Number(semanticScore.toFixed(4)),
        keywordScore: Number(keywordScore.toFixed(4)),
        metadata: c.metadata,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, numberOfResults);
}

// Shape a result list exactly like the bedrock-agent-runtime Retrieve API response.
export function toBedrockRetrieveResponse(results: RetrievalResult[]) {
  return {
    retrievalResults: results.map((r) => ({
      content: { text: r.text, type: "TEXT" },
      location: { type: "S3", s3Location: { uri: r.uri } },
      score: r.score,
      metadata: r.metadata,
    })),
    guardrailAction: "NONE",
  };
}
