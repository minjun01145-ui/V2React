import type { AssistantOperation, AssistantReply } from "./types.ts";

const OPS = new Set(["move", "resize", "style", "setText", "delete", "addText", "addShape", "addImage", "background"]);
const NEEDS_ID = new Set(["move", "resize", "style", "setText", "delete"]);
const ID_PATTERN = /^o\d{1,3}$/;
const MAX_OPERATIONS = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Checks the shape of the server's reply. The server already validated every field against the
 * same rules; this only guards the browser against an unexpected response.
 */
export function parseAssistantReply(value: unknown): AssistantReply {
  if (!isRecord(value) || !Array.isArray(value.operations) || value.operations.length > MAX_OPERATIONS) throw new Error("AI 응답을 확인하지 못했습니다.");
  const operations = value.operations.filter((operation): operation is AssistantOperation => isRecord(operation)
    && typeof operation.op === "string" && OPS.has(operation.op)
    && (!NEEDS_ID.has(operation.op) || (typeof operation.id === "string" && ID_PATTERN.test(operation.id))));
  if (operations.length !== value.operations.length) throw new Error("AI 응답을 확인하지 못했습니다.");
  return { message: typeof value.message === "string" ? value.message.slice(0, 300) : "", operations };
}
