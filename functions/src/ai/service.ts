import { readAiProviderSettings, writeAiProviderSettings } from "./configRepository.js";
import { listOllamaCloudModels, sendOllamaCloudChat } from "./ollamaProvider.js";
import { hasOllamaApiKey, readOllamaApiKey, writeOllamaApiKey } from "./secretStore.js";
import type { AdminAiSettingsView, AiChatResult, AiMessage, AiModelListResult, AiProviderSettings } from "./types.js";
import { assertAiMessages } from "./validation.js";

export async function getAdminAiSettings(): Promise<AdminAiSettingsView> {
  const [settings, apiKeyConfigured] = await Promise.all([readAiProviderSettings(), hasOllamaApiKey()]);
  return { ...settings, apiKeyConfigured };
}

export async function saveAdminAiSettings(
  settings: Omit<AiProviderSettings, "updatedAtMs">,
  apiKey: string | null,
  adminUid: string,
): Promise<AdminAiSettingsView> {
  if (apiKey) await writeOllamaApiKey(apiKey);
  const saved = await writeAiProviderSettings(settings, adminUid);
  return { ...saved, apiKeyConfigured: apiKey ? true : await hasOllamaApiKey() };
}

async function readyProvider(): Promise<{ readonly settings: AiProviderSettings; readonly apiKey: string }> {
  const settings = await readAiProviderSettings();
  if (!settings.enabled) throw new Error("AI 공급자가 비활성화되어 있습니다.");
  return { settings, apiKey: await readOllamaApiKey() };
}

export async function testAiProviderConnection(): Promise<AiModelListResult> {
  const { settings, apiKey } = await readyProvider();
  return listOllamaCloudModels(settings, apiKey);
}

export async function generateAiReply(messages: readonly AiMessage[]): Promise<AiChatResult> {
  assertAiMessages(messages);
  const { settings, apiKey } = await readyProvider();
  return sendOllamaCloudChat(settings, apiKey, messages);
}
