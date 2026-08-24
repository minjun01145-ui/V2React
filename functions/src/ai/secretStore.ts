import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { isRecord } from "../shared/validation.js";

export const OLLAMA_API_KEY_SECRET_ID = "jurye-ollama-cloud-api-key";

const client = new SecretManagerServiceClient();

function secretName(): string {
  const projectId = String(process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "").trim();
  if (!projectId) throw new Error("Firebase 프로젝트 ID를 확인할 수 없습니다.");
  return `projects/${projectId}/secrets/${OLLAMA_API_KEY_SECRET_ID}`;
}

function isMissingSecret(error: unknown): boolean {
  return isRecord(error) && (error.code === 5 || error.code === "5");
}

export async function readOllamaApiKey(): Promise<string> {
  let response;
  try {
    response = await client.accessSecretVersion({ name: `${secretName()}/versions/latest` });
  } catch (error: unknown) {
    if (isMissingSecret(error)) throw new Error("Ollama API 키가 아직 설정되지 않았습니다.");
    throw error;
  }
  const value = response[0].payload?.data?.toString("utf8").trim() ?? "";
  if (!value) throw new Error("Ollama API 키가 비어 있습니다.");
  return value;
}

export async function hasOllamaApiKey(): Promise<boolean> {
  try {
    await readOllamaApiKey();
    return true;
  } catch (error: unknown) {
    if (isMissingSecret(error) || (error instanceof Error && /아직 설정|비어 있습니다/.test(error.message))) return false;
    throw error;
  }
}

export async function writeOllamaApiKey(apiKey: string): Promise<void> {
  await client.addSecretVersion({
    parent: secretName(),
    payload: { data: Buffer.from(apiKey, "utf8") },
  });
}
