import type { OllamaConfig } from "./config";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function ensureOllama(cfg: OllamaConfig): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${cfg.host}/api/tags`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new Error(`Cannot reach Ollama at ${cfg.host}. Start it with: ollama serve`);
  }
  if (!res.ok) throw new Error(`Ollama responded with ${res.status} at ${cfg.host}`);
  const data = (await res.json()) as { models?: { name: string }[] };
  const names = (data.models ?? []).map((m) => m.name);
  const wanted = cfg.model.includes(":") ? cfg.model : `${cfg.model}:latest`;
  if (!names.includes(wanted)) {
    throw new Error(`Model ${cfg.model} is not installed. Run: ollama pull ${cfg.model}`);
  }
}

export async function ollamaChat(
  cfg: OllamaConfig,
  messages: ChatMessage[],
  timeoutMs = 120_000,
): Promise<string> {
  const res = await fetch(`${cfg.host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
      format: "json",
      options: { temperature: 0 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}
