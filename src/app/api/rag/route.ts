import { randomUUID } from "node:crypto";
import { buildRagGraph, toBedrockRagResponse, type RagOptions, type RagStateType } from "@/lib/graph";
import { DEFAULT_KB_CONFIG } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Streams one NDJSON line per LangGraph node so the UI can animate the pipeline live.
export async function POST(req: Request) {
  const body = await req.json();
  const apiKey = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY || undefined;
  const opts: RagOptions = {
    apiKey,
    groqModel: body.groqModel || "llama-3.3-70b-versatile",
    kbConfig: { ...DEFAULT_KB_CONFIG, ...body.kbConfig },
    numberOfResults: Math.min(10, Math.max(1, Number(body.numberOfResults) || 5)),
    searchType: body.searchType === "HYBRID" ? "HYBRID" : "SEMANTIC",
    useGuardrail: body.useGuardrail !== false,
    gradeDocuments: body.gradeDocuments !== false,
  };
  const question = String(body.question ?? "").slice(0, 2000);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      const state: Partial<RagStateType> = { question };
      try {
        const app = buildRagGraph(opts);
        let t = Date.now();
        send({ type: "start", mode: apiKey ? "groq" : "offline", model: opts.groqModel });
        for await (const chunk of await app.stream({ question }, { streamMode: "updates" })) {
          for (const [node, update] of Object.entries(chunk as Record<string, Partial<RagStateType>>)) {
            Object.assign(state, update);
            const now = Date.now();
            send({ type: "node", node, update, ms: now - t });
            t = now;
          }
        }
        const sources = state.relevant ?? [];
        const guardrailAction =
          state.inputGuardrail?.action === "GUARDRAIL_INTERVENED" || state.outputGuardrail?.action === "GUARDRAIL_INTERVENED"
            ? "INTERVENED"
            : "NONE";
        send({
          type: "final",
          answer: state.answer,
          sources,
          response: toBedrockRagResponse(state.answer ?? "", sources, guardrailAction, randomUUID()),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: /401|invalid api key/i.test(msg) ? "Groq rejected the API key (401). Check the key in the header bar." : msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
