import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebaseClient.ts";
import type {
  AiConnectionResult,
  AiMessageTestInput,
  AiMessageTestResult,
  AiProviderSettings,
  AiProviderSettingsInput,
} from "./types.ts";
import { validateAiSettings, validateAiTestMessage } from "./validation.ts";

export async function getAiProviderSettings(): Promise<AiProviderSettings> {
  const callable = httpsCallable<Record<string, never>, AiProviderSettings>(functions, "getAiProviderSettings");
  return (await callable({})).data;
}

export async function saveAiProviderSettings(input: AiProviderSettingsInput): Promise<AiProviderSettings> {
  validateAiSettings(input);
  const callable = httpsCallable<AiProviderSettingsInput, AiProviderSettings>(functions, "saveAiProviderSettings");
  return (await callable(input)).data;
}

export async function testAiProviderConnection(): Promise<AiConnectionResult> {
  const callable = httpsCallable<Record<string, never>, AiConnectionResult>(functions, "testAiConnection");
  return (await callable({})).data;
}

export async function sendAiTestMessage(input: AiMessageTestInput): Promise<AiMessageTestResult> {
  validateAiTestMessage(input);
  const callable = httpsCallable<AiMessageTestInput, AiMessageTestResult>(functions, "sendAiTestMessage");
  return (await callable(input)).data;
}
