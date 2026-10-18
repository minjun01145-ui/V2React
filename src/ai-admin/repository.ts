import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type {
  AiConnectionResult,
  AiMessageTestInput,
  AiMessageTestResult,
  AiProviderSettings,
  AiProviderSettingsInput,
  AiSlot,
} from "./types.ts";
import { validateAiSettings, validateAiTestMessage } from "./validation.ts";

export async function getAiProviderSettings(slot: AiSlot = "ai1"): Promise<AiProviderSettings> {
  const callable = httpsCallable<{ slot: AiSlot }, AiProviderSettings>(functions, "getAiProviderSettings");
  return (await callable({ slot })).data;
}

export async function saveAiProviderSettings(input: AiProviderSettingsInput, slot: AiSlot = "ai1"): Promise<AiProviderSettings> {
  validateAiSettings(input);
  const callable = httpsCallable<AiProviderSettingsInput & { slot: AiSlot }, AiProviderSettings>(functions, "saveAiProviderSettings");
  return (await callable({ ...input, slot })).data;
}

export async function testAiProviderConnection(slot: AiSlot = "ai1"): Promise<AiConnectionResult> {
  const callable = httpsCallable<{ slot: AiSlot }, AiConnectionResult>(functions, "testAiConnection", { timeout: 360_000 });
  return (await callable({ slot })).data;
}

export async function sendAiTestMessage(input: AiMessageTestInput, slot: AiSlot = "ai1"): Promise<AiMessageTestResult> {
  validateAiTestMessage(input);
  const callable = httpsCallable<AiMessageTestInput & { slot: AiSlot }, AiMessageTestResult>(functions, "sendAiTestMessage", { timeout: 360_000 });
  return (await callable({ ...input, slot })).data;
}
