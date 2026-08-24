import { isRecord } from "../shared/validation.js";
import { AI_PROVIDER, OLLAMA_CLOUD_BASE_URL, type AiMessage, type AiProviderSettings, type AiThinkingLevel } from "./types.js";

const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const THINKING_LEVELS = new Set<AiThinkingLevel>(["off", "low", "medium", "high"]);

export class AiValidationError extends Error {}

function finiteNumber(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new AiValidationError(`${label} 값을 확인해주세요.`);
  return parsed;
}

export function parseAiProviderSettings(value: unknown): Omit<AiProviderSettings, "updatedAtMs"> {
  if (!isRecord(value)) throw new AiValidationError("AI 설정을 확인해주세요.");
  const model = String(value.model ?? "").trim();
  const temperature = finiteNumber(value.temperature, "Temperature");
  const maxOutputTokens = Math.trunc(finiteNumber(value.maxOutputTokens, "최대 출력 토큰"));
  const timeoutSeconds = Math.trunc(finiteNumber(value.timeoutSeconds, "응답 제한 시간"));
  const thinkingLevel = String(value.thinkingLevel ?? "off") as AiThinkingLevel;

  if (!MODEL_PATTERN.test(model)) throw new AiValidationError("Ollama 모델 이름을 확인해주세요.");
  if (temperature < 0 || temperature > 2) throw new AiValidationError("Temperature는 0부터 2까지 설정할 수 있습니다.");
  if (maxOutputTokens < 16 || maxOutputTokens > 4096) throw new AiValidationError("최대 출력 토큰은 16부터 4096까지 설정할 수 있습니다.");
  if (timeoutSeconds < 10 || timeoutSeconds > 120) throw new AiValidationError("응답 제한 시간은 10초부터 120초까지 설정할 수 있습니다.");
  if (!THINKING_LEVELS.has(thinkingLevel)) throw new AiValidationError("사고 수준 설정을 확인해주세요.");

  return {
    provider: AI_PROVIDER,
    baseUrl: OLLAMA_CLOUD_BASE_URL,
    model,
    temperature,
    maxOutputTokens,
    thinkingLevel,
    timeoutSeconds,
    enabled: value.enabled !== false,
  };
}

export function parseOptionalApiKey(value: unknown): string | null {
  const apiKey = String(value ?? "").trim();
  if (!apiKey) return null;
  if (apiKey.length < 16 || apiKey.length > 512 || /\s/.test(apiKey)) {
    throw new AiValidationError("Ollama API 키 형식을 확인해주세요.");
  }
  return apiKey;
}

export function parseAdminTestMessage(value: unknown): { readonly messages: readonly AiMessage[] } {
  if (!isRecord(value)) throw new AiValidationError("테스트 메시지를 입력해주세요.");
  const prompt = String(value.prompt ?? "").trim();
  const systemPrompt = String(value.systemPrompt ?? "").trim();
  if (prompt.length < 1 || prompt.length > 4000) throw new AiValidationError("테스트 메시지는 1자부터 4000자까지 입력할 수 있습니다.");
  if (systemPrompt.length > 2000) throw new AiValidationError("시스템 지시는 2000자 이하로 입력해주세요.");
  return {
    messages: [
      ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      { role: "user" as const, content: prompt },
    ],
  };
}

export function assertAiMessages(messages: readonly AiMessage[]): void {
  if (messages.length < 1 || messages.length > 20) throw new AiValidationError("AI 메시지는 1개부터 20개까지 전송할 수 있습니다.");
  let totalLength = 0;
  for (const message of messages) {
    if (!(["system", "user", "assistant"] as const).includes(message.role)) throw new AiValidationError("지원하지 않는 메시지 역할입니다.");
    if (!message.content.trim() || message.content.length > 8000) throw new AiValidationError("AI 메시지 내용을 확인해주세요.");
    totalLength += message.content.length;
  }
  if (totalLength > 16000) throw new AiValidationError("한 번에 전송할 수 있는 메시지 길이를 초과했습니다.");
}
