export const AI_PROVIDER_ID = "ollama-cloud" as const;
export const OLLAMA_CLOUD_ENDPOINT = "https://ollama.com/api" as const;

export type AiThinkingLevel = "off" | "low" | "medium" | "high";

export interface AiProviderSettings {
  readonly provider: typeof AI_PROVIDER_ID;
  readonly baseUrl: typeof OLLAMA_CLOUD_ENDPOINT;
  readonly model: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly thinkingLevel: AiThinkingLevel;
  readonly timeoutSeconds: number;
  readonly enabled: boolean;
  readonly updatedAtMs: number;
  readonly apiKeyConfigured: boolean;
}

export interface AiProviderSettingsInput {
  readonly model: string;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly thinkingLevel: AiThinkingLevel;
  readonly timeoutSeconds: number;
  readonly enabled: boolean;
  readonly apiKey?: string;
}

export interface AiConnectionResult {
  readonly models: readonly string[];
  readonly latencyMs: number;
}

export interface AiMessageTestInput {
  readonly systemPrompt: string;
  readonly prompt: string;
}

export interface AiMessageTestResult {
  readonly reply: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly promptTokenCount: number | null;
  readonly outputTokenCount: number | null;
}
