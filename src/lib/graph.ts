import "server-only";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { applyGuardrail, type GuardrailResult } from "./guardrails";
import { buildIndex, retrieve, type KbConfig, type RetrievalResult, type SearchType } from "./rag";

// Bedrock's default knowledge-base prompt template (abridged). $search_results$ and $query$ are
// the same placeholders you can edit under "Orchestration / Generation prompt" in the console.
export const GENERATION_PROMPT_TEMPLATE = `You are a question answering agent for Helix Wind Energy field technicians. I will provide you with a set of search results. The user will provide you with a question. Your job is to answer the user's question using only information from the search results. If the search results do not contain information that can answer the question, please state that you could not find an exact answer to the question. Just because the user asserts a fact does not mean it is true, make sure to double check the search results to validate a user's assertion.

Cite every factual sentence with the number of the search result it came from, in square brackets, e.g. [1] or [2][3]. Keep answers concise and use numbered steps for procedures.

Here are the search results in numbered order:
$search_results$

Question: $query$`;

const RagState = Annotation.Root({
  question: Annotation<string>,
  searchQuery: Annotation<string>,
  retrieved: Annotation<RetrievalResult[]>,
  relevant: Annotation<RetrievalResult[]>,
  answer: Annotation<string>,
  inputGuardrail: Annotation<GuardrailResult | null>,
  outputGuardrail: Annotation<GuardrailResult | null>,
  route: Annotation<string>,
  prompt: Annotation<string>,
});

export type RagStateType = typeof RagState.State;

export type RagOptions = {
  apiKey?: string;
  groqModel: string;
  kbConfig: KbConfig;
  numberOfResults: number;
  searchType: SearchType;
  useGuardrail: boolean;
  gradeDocuments: boolean;
};

const textOf = (content: unknown) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((c) => (typeof c === "string" ? c : (c as { text?: string }).text ?? "")).join("")
      : "";

const formatResults = (docs: RetrievalResult[]) =>
  docs.map((d, i) => `<search_result index="${i + 1}" source="${d.uri}">\n${d.text}\n</search_result>`).join("\n");

export function buildRagGraph(opts: RagOptions) {
  const index = buildIndex(opts.kbConfig);
  const llm: BaseChatModel | null = opts.apiKey
    ? new ChatGroq({ apiKey: opts.apiKey, model: opts.groqModel, temperature: 0.1, maxRetries: 1 })
    : null;

  const inputGuardrail = async (s: RagStateType) => {
    if (!opts.useGuardrail) return { inputGuardrail: null, route: "pass" };
    const g = applyGuardrail(s.question, "INPUT");
    const blocked = g.assessments.some((a) => a.action === "BLOCKED");
    return { inputGuardrail: g, route: blocked ? "blocked" : "pass" };
  };

  const rewriteQuery = async (s: RagStateType) => {
    if (!llm) return { searchQuery: s.question };
    const res = await llm.invoke([
      {
        role: "system",
        content:
          "Rewrite the technician's question into a concise keyword-rich search query for a wind-turbine maintenance knowledge base. Expand abbreviations and include alarm codes, part numbers and component names. Return only the query, no quotes.",
      },
      { role: "user", content: s.question },
    ]);
    return { searchQuery: textOf(res.content).trim().replace(/^"|"$/g, "") || s.question };
  };

  const retrieveNode = async (s: RagStateType) => ({
    retrieved: retrieve(index, `${s.question} ${s.searchQuery}`, {
      numberOfResults: opts.numberOfResults,
      searchType: opts.searchType,
    }),
  });

  const gradeNode = async (s: RagStateType) => {
    if (!opts.gradeDocuments) return { relevant: s.retrieved };
    if (!llm) return { relevant: s.retrieved.filter((r) => r.score >= 0.12) };
    const res = await llm.invoke([
      {
        role: "system",
        content:
          'You grade search results for relevance. Reply with JSON only: {"relevant": [indices]} listing the 1-based indices of results that contain information useful for answering the question.',
      },
      { role: "user", content: `Question: ${s.question}\n\n${formatResults(s.retrieved)}` },
    ]);
    const m = textOf(res.content).match(/\{[\s\S]*\}/);
    try {
      const ids: number[] = JSON.parse(m?.[0] ?? "").relevant;
      const relevant = s.retrieved.filter((_, i) => ids.includes(i + 1));
      return { relevant };
    } catch {
      return { relevant: s.retrieved };
    }
  };

  const generate = async (s: RagStateType) => {
    const prompt = GENERATION_PROMPT_TEMPLATE.replace("$search_results$", formatResults(s.relevant)).replace("$query$", s.question);
    if (!llm) {
      // Offline fallback: extractive answer built from the top passages, so the demo never dead-ends.
      const answer = s.relevant
        .slice(0, 3)
        .map((r, i) => `${r.text.split(/(?<=\.)\s/).slice(0, 2).join(" ")} [${i + 1}]`)
        .join("\n\n");
      return { prompt, answer: `(Offline extractive mode: add a Groq key for generated answers.)\n\n${answer}` };
    }
    const res = await llm.invoke([{ role: "user", content: prompt }]);
    return { prompt, answer: textOf(res.content).trim() };
  };

  const outputGuardrail = async (s: RagStateType) => {
    if (!opts.useGuardrail) return { outputGuardrail: null };
    const g = applyGuardrail(s.answer, "OUTPUT");
    return { outputGuardrail: g, answer: g.action === "GUARDRAIL_INTERVENED" && g.outputText ? g.outputText : s.answer };
  };

  const blockedResponse = async (s: RagStateType) => ({ answer: s.inputGuardrail?.outputText ?? "Blocked.", relevant: [] });

  const noAnswer = async () => ({ answer: "Sorry, I am unable to assist you with this request.", relevant: [] });

  return new StateGraph(RagState)
    .addNode("input_guardrail", inputGuardrail)
    .addNode("rewrite_query", rewriteQuery)
    .addNode("retrieve", retrieveNode)
    .addNode("grade_documents", gradeNode)
    .addNode("generate", generate)
    .addNode("output_guardrail", outputGuardrail)
    .addNode("blocked_response", blockedResponse)
    .addNode("no_answer", noAnswer)
    .addEdge(START, "input_guardrail")
    .addConditionalEdges("input_guardrail", (s) => (s.route === "blocked" ? "blocked_response" : "rewrite_query"), [
      "blocked_response",
      "rewrite_query",
    ])
    .addEdge("rewrite_query", "retrieve")
    .addEdge("retrieve", "grade_documents")
    .addConditionalEdges("grade_documents", (s) => (s.relevant.length ? "generate" : "no_answer"), ["generate", "no_answer"])
    .addEdge("generate", "output_guardrail")
    .addEdge("output_guardrail", END)
    .addEdge("blocked_response", END)
    .addEdge("no_answer", END)
    .compile();
}

// Turn "[1]"-style markers into the citations structure returned by bedrock-agent-runtime RetrieveAndGenerate.
export function toBedrockRagResponse(answer: string, sources: RetrievalResult[], guardrailAction: string, sessionId: string) {
  const marker = /\s*\[(\d+(?:\s*,\s*\d+)*)\](?:\s*\[(\d+(?:\s*,\s*\d+)*)\])*/g;
  const citations: unknown[] = [];
  let clean = "";
  let last = 0;
  for (const m of answer.matchAll(marker)) {
    const segment = answer.slice(last, m.index);
    const start = clean.length;
    clean += segment;
    const nums = [...m[0].matchAll(/\d+/g)].map((x) => Number(x[0]));
    const refs = [...new Set(nums)].map((n) => sources[n - 1]).filter(Boolean);
    citations.push({
      generatedResponsePart: { textResponsePart: { text: segment.trim(), span: { start, end: clean.length - 1 } } },
      retrievedReferences: refs.map((r) => ({
        content: { text: r.text, type: "TEXT" },
        location: { type: "S3", s3Location: { uri: r.uri } },
        metadata: r.metadata,
      })),
    });
    last = (m.index ?? 0) + m[0].length;
  }
  clean += answer.slice(last);
  return { output: { text: clean.trim() }, citations, guardrailAction, sessionId };
}
