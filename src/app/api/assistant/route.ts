import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { SystemMessage } from "@langchain/core/messages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SYSTEM = `You are "Bedrock Coach", an expert AWS Solutions Architect co-presenting a live, one-hour hands-on workshop on Retrieval-Augmented Generation (RAG) with Amazon Bedrock Knowledge Bases.
The workshop runs in a sandbox that faithfully simulates Bedrock: documents in S3, chunking, Titan Text Embeddings V2, a vector store (OpenSearch Serverless / S3 Vectors / Aurora pgvector), the Retrieve and RetrieveAndGenerate APIs, and Guardrails. Generation uses Llama 3.3 70B served by Groq as a stand-in for meta.llama3-3-70b-instruct-v1:0 on Bedrock (same open model family). Orchestration is a LangGraph graph.
Industrial scenario: Helix Wind Energy (fictional) runs 420 HX-3000 wind turbines; field technicians query manuals, SOP-114 LOTO safety, SCADA alarm codes, incident report IR-2025-037, spare parts and warranty terms.
Answer clearly and practically, with short paragraphs or bullets, real AWS API/console names, and boto3 snippets when useful. When asked what to do next, give the next concrete step in the workshop. Be honest about what is simulated versus what real AWS does, and mention cost or quota caveats where relevant.`;

export async function POST(req: Request) {
  const apiKey = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "Add your Groq API key (BYOK) in the header to use the assistant." }, { status: 400 });
  const { messages = [], context = "", groqModel = "llama-3.3-70b-versatile" } = await req.json();

  const llm = new ChatGroq({ apiKey, model: groqModel, temperature: 0.4, maxRetries: 1 });
  const coach = async (state: typeof MessagesAnnotation.State) => ({
    messages: [await llm.invoke([new SystemMessage(`${SYSTEM}\n\nCurrent workshop context:\n${context}`), ...state.messages])],
  });
  const graph = new StateGraph(MessagesAnnotation).addNode("coach", coach).addEdge(START, "coach").addEdge("coach", END).compile();

  try {
    const result = await graph.invoke({
      messages: (messages as { role: "user" | "assistant"; content: string }[]).slice(-12).map((m) => ({ role: m.role, content: m.content })),
    });
    const last = result.messages[result.messages.length - 1];
    return Response.json({ reply: typeof last.content === "string" ? last.content : JSON.stringify(last.content) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: /401|invalid api key/i.test(msg) ? "Groq rejected the API key (401)." : msg }, { status: 500 });
  }
}
