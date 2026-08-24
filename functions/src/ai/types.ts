export const AI_PROVIDER = "ollama-cloud" as const;
export const OLLAMA_CLOUD_BASE_URL = "https://ollama.com/api" as const;

export type AiMessageRole = "system" | "user" | "assistant";
export type AiThinkingLevel = "off" | "low" | "medium" | "high";

export interface AiMessage {
  readonly role: AiMessageRole;
  readonly content: string;
}

export interface AiProviderSettings {
  readonly provider: typeof AI_PROVIDER;
  readonly baseUrl: typeof OLLAMA_CLOUD_BASE_URL;
  readonly model: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly thinkingLevel: AiThinkingLevel;
  readonly timeoutSeconds: number;
  readonly enabled: boolean;
  readonly updatedAtMs: number;
}

export interface AiChatResult {
  readonly reply: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly promptTokenCount: number | null;
  readonly outputTokenCount: number | null;
}

export interface AiModelListResult {
  readonly models: readonly string[];
  readonly latencyMs: number;
}

export interface AdminAiSettingsView extends AiProviderSettings {
  readonly apiKeyConfigured: boolean;
}
