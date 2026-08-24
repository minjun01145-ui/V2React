import { isRecord } from "../shared/validation.js";
import type { AiChatResult, AiMessage, AiModelListResult, AiProviderSettings } from "./types.js";

export class AiProviderError extends Error {
  constructor(message: string, readonly status: number | null = null) {
    super(message);
  }
}

function endpoint(settings: AiProviderSettings, path: "chat" | "tags"): string {
  return `${settings.baseUrl}/${path}`;
}

async function providerJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    let providerMessage = "";
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed) && typeof parsed.error === "string") providerMessage = parsed.error;
    } catch {
      providerMessage = "";
    }
    const suffix = providerMessage ? `: ${providerMessage.slice(0, 240)}` : "";
    throw new AiProviderError(`Ollama Cloud 요청이 실패했습니다 (${response.status})${suffix}`, response.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiProviderError("Ollama Cloud가 올바른 JSON 응답을 반환하지 않았습니다.", response.status);
  }
}

function authHeaders(apiKey: string): Readonly<Record<string, string>> {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function listOllamaCloudModels(
  settings: AiProviderSettings,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AiModelListResult> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(endpoint(settings, "tags"), {
      method: "GET",
      headers: authHeaders(apiKey),
      signal: AbortSignal.timeout(settings.timeoutSeconds * 1000),
    });
  } catch {
    throw new AiProviderError("Ollama Cloud에 연결하지 못했습니다.");
  }
  const raw = await providerJson(response);
  const models = isRecord(raw) && Array.isArray(raw.models)
    ? raw.models.flatMap((item) => isRecord(item) && typeof item.name === "string" ? [item.name] : [])
    : [];
  return { models: [...new Set(models)].sort(), latencyMs: Date.now() - startedAt };
}

export async function sendOllamaCloudChat(
  settings: AiProviderSettings,
  apiKey: string,
  messages: readonly AiMessage[],
  fetchImpl: typeof fetch = fetch,
): Promise<AiChatResult> {
  const startedAt = Date.now();
  const think = settings.thinkingLevel === "off" ? false : settings.thinkingLevel;
  let response: Response;
  try {
    response = await fetchImpl(endpoint(settings, "chat"), {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        model: settings.model,
        messages,
        stream: false,
        think,
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxOutputTokens,
        },
      }),
      signal: AbortSignal.timeout(settings.timeoutSeconds * 1000),
    });
  } catch {
    throw new AiProviderError("Ollama Cloud 응답을 기다리는 중 연결이 끊겼습니다.");
  }

  const raw = await providerJson(response);
  const message = isRecord(raw) && isRecord(raw.message) ? raw.message : null;
  const reply = message && typeof message.content === "string" ? message.content.trim() : "";
  if (!reply) throw new AiProviderError("Ollama Cloud 응답에 답변 내용이 없습니다.", response.status);

  return {
    reply,
    model: isRecord(raw) && typeof raw.model === "string" ? raw.model : settings.model,
    latencyMs: Date.now() - startedAt,
    promptTokenCount: isRecord(raw) && typeof raw.prompt_eval_count === "number" ? raw.prompt_eval_count : null,
    outputTokenCount: isRecord(raw) && typeof raw.eval_count === "number" ? raw.eval_count : null,
  };
}
