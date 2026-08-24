import type { AiMessageTestInput, AiProviderSettingsInput, AiThinkingLevel } from "./types.ts";

const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,119}$/;
const THINKING_LEVELS = new Set<AiThinkingLevel>(["off", "low", "medium", "high"]);

export function validateAiSettings(input: AiProviderSettingsInput): void {
  if (!MODEL_PATTERN.test(input.model.trim())) throw new Error("Ollama 모델 이름을 확인해주세요.");
  if (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2) throw new Error("Temperature는 0부터 2까지 설정할 수 있습니다.");
  if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 16 || input.maxOutputTokens > 4096) throw new Error("최대 출력 토큰은 16부터 4096까지 설정할 수 있습니다.");
  if (!Number.isInteger(input.timeoutSeconds) || input.timeoutSeconds < 10 || input.timeoutSeconds > 120) throw new Error("응답 제한 시간은 10초부터 120초까지 설정할 수 있습니다.");
  if (!THINKING_LEVELS.has(input.thinkingLevel)) throw new Error("사고 수준 설정을 확인해주세요.");
  if (input.apiKey && (input.apiKey.length < 16 || input.apiKey.length > 512 || /\s/.test(input.apiKey))) throw new Error("Ollama API 키 형식을 확인해주세요.");
}

export function validateAiTestMessage(input: AiMessageTestInput): void {
  const promptLength = input.prompt.trim().length;
  if (promptLength < 1 || promptLength > 4000) throw new Error("테스트 메시지는 1자부터 4000자까지 입력할 수 있습니다.");
  if (input.systemPrompt.trim().length > 2000) throw new Error("시스템 지시는 2000자 이하로 입력해주세요.");
}
