import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { AI_PROVIDER, OLLAMA_CLOUD_BASE_URL, type AiProviderSettings, type AiThinkingLevel } from "./types.js";

const configRef = db.collection("aiProviderConfigs").doc(AI_PROVIDER);

export const DEFAULT_AI_PROVIDER_SETTINGS: AiProviderSettings = Object.freeze({
  provider: AI_PROVIDER,
  baseUrl: OLLAMA_CLOUD_BASE_URL,
  model: "gpt-oss:120b",
  temperature: 0.3,
  maxOutputTokens: 512,
  thinkingLevel: "off",
  timeoutSeconds: 60,
  enabled: true,
  updatedAtMs: 0,
});

function savedThinkingLevel(value: unknown): AiThinkingLevel {
  return value === "low" || value === "medium" || value === "high" ? value : "off";
}

export async function readAiProviderSettings(): Promise<AiProviderSettings> {
  const snapshot = await configRef.get();
  const raw: unknown = snapshot.exists ? snapshot.data() : null;
  if (!isRecord(raw)) return DEFAULT_AI_PROVIDER_SETTINGS;
  return {
    provider: AI_PROVIDER,
    baseUrl: OLLAMA_CLOUD_BASE_URL,
    model: typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : DEFAULT_AI_PROVIDER_SETTINGS.model,
    temperature: typeof raw.temperature === "number" ? raw.temperature : DEFAULT_AI_PROVIDER_SETTINGS.temperature,
    maxOutputTokens: typeof raw.maxOutputTokens === "number" ? raw.maxOutputTokens : DEFAULT_AI_PROVIDER_SETTINGS.maxOutputTokens,
    thinkingLevel: savedThinkingLevel(raw.thinkingLevel),
    timeoutSeconds: typeof raw.timeoutSeconds === "number" ? raw.timeoutSeconds : DEFAULT_AI_PROVIDER_SETTINGS.timeoutSeconds,
    enabled: raw.enabled !== false,
    updatedAtMs: typeof raw.updatedAtMs === "number" ? raw.updatedAtMs : 0,
  };
}

export async function writeAiProviderSettings(
  settings: Omit<AiProviderSettings, "updatedAtMs">,
  adminUid: string,
): Promise<AiProviderSettings> {
  const updatedAtMs = Date.now();
  const saved: AiProviderSettings = { ...settings, updatedAtMs };
  await configRef.set({
    ...saved,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminUid,
  }, { merge: true });
  return saved;
}
