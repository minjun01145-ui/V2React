import { FieldValue } from "firebase-admin/firestore";
import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { AI_PROVIDER, OLLAMA_CLOUD_BASE_URL, type AiProviderSettings, type AiThinkingLevel, type AiSlot } from "./types.js";


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
  return value === "low" || value === "medium" || value === "high" || value === "max" ? value : "off";
}

export function copyAi2Settings(ai1: AiProviderSettings): AiProviderSettings {
  return { ...ai1, thinkingLevel: "max", maxOutputTokens: Math.max(8192, ai1.maxOutputTokens), timeoutSeconds: 300, updatedAtMs: 0 };
}

export async function readAiProviderSettings(slot: AiSlot = "ai1"): Promise<AiProviderSettings> {
  const snapshot = await db.collection("aiProviderConfigs").doc(slot === "ai1" ? AI_PROVIDER : `${AI_PROVIDER}-ai2`).get();
  const raw: unknown = snapshot.exists ? snapshot.data() : null;
  if (!isRecord(raw)) return slot === "ai2" ? copyAi2Settings(await readAiProviderSettings("ai1")) : DEFAULT_AI_PROVIDER_SETTINGS;
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
  slot: AiSlot = "ai1",
): Promise<AiProviderSettings> {
  const updatedAtMs = Date.now();
  const saved: AiProviderSettings = { ...settings, updatedAtMs };
  await db.collection("aiProviderConfigs").doc(slot === "ai1" ? AI_PROVIDER : `${AI_PROVIDER}-ai2`).set({
    ...saved,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminUid,
  }, { merge: true });
  return saved;
}
