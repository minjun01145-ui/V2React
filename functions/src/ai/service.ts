import { readAiProviderSettings, writeAiProviderSettings } from "./configRepository.js";
import { listOllamaCloudModels, sendOllamaCloudChat } from "./ollamaProvider.js";
import { hasOllamaApiKey, readOllamaApiKey, writeOllamaApiKey } from "./secretStore.js";
import type { AdminAiSettingsView, AiChatResult, AiMessage, AiModelListResult, AiProviderSettings, AiThinkingLevel, AiSlot } from "./types.js";
import { assertAiMessages } from "./validation.js";

export async function getAdminAiSettings(slot: AiSlot = "ai1"): Promise<AdminAiSettingsView> {
  const [settings, apiKeyConfigured] = await Promise.all([readAiProviderSettings(slot), hasOllamaApiKey()]);
  return { ...settings, apiKeyConfigured };
}

export async function saveAdminAiSettings(
  settings: Omit<AiProviderSettings, "updatedAtMs">,
  apiKey: string | null,
  adminUid: string,
  slot: AiSlot = "ai1",
): Promise<AdminAiSettingsView> {
  if (apiKey) await writeOllamaApiKey(apiKey);
  const saved = await writeAiProviderSettings(settings, adminUid, slot);
  return { ...saved, apiKeyConfigured: apiKey ? true : await hasOllamaApiKey() };
}

async function readyProvider(slot: AiSlot): Promise<{ readonly settings: AiProviderSettings; readonly apiKey: string }> {
  const settings = await readAiProviderSettings(slot);
  if (!settings.enabled) throw new Error("AI 공급자가 비활성화되어 있습니다.");
  return { settings, apiKey: await readOllamaApiKey() };
}

export async function testAiProviderConnection(slot: AiSlot = "ai1"): Promise<AiModelListResult> {
  const { settings, apiKey } = await readyProvider(slot);
  return listOllamaCloudModels(settings, apiKey);
}

export async function generateAiReply(
  messages: readonly AiMessage[],
  options: { readonly slot?: AiSlot; readonly minimumOutputTokens?: number; readonly thinkingLevel?: AiThinkingLevel } = {},
): Promise<AiChatResult> {
  assertAiMessages(messages);
  const { settings, apiKey } = await readyProvider(options.slot ?? "ai1");
  const minimumOutputTokens = Math.min(16384, Math.max(0, Math.trunc(options.minimumOutputTokens ?? 0)));
  const thinkingLevel = options.thinkingLevel ?? settings.thinkingLevel;
  return sendOllamaCloudChat(
    { ...settings, thinkingLevel, ...(minimumOutputTokens > settings.maxOutputTokens ? { maxOutputTokens: minimumOutputTokens } : {}) },
    apiKey,
    messages,
  );
}
