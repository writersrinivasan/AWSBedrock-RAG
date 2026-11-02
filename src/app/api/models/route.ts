export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Validates the BYOK key and lists the chat models it can use.
export async function GET(req: Request) {
  const apiKey = req.headers.get("x-groq-key") || process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ ok: false, error: "No key" }, { status: 400 });
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!res.ok) return Response.json({ ok: false, error: `Groq returned ${res.status}` }, { status: res.status });
  const data = (await res.json()) as { data: { id: string; active?: boolean }[] };
  const models = data.data
    .filter((m) => m.active !== false && !/whisper|tts|guard|embed|playai|orpheus/i.test(m.id))
    .map((m) => m.id)
    .sort();
  return Response.json({ ok: true, models });
}
