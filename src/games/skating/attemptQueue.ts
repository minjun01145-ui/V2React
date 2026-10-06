import { persistGameAttempt } from "../../multiplayer/game-progress/repository.ts";

type AttemptSubmission = Parameters<typeof persistGameAttempt>[0];

const RETRY_DELAYS_MS = [250, 750, 1_500, 3_000, 5_000] as const;
const RETRYABLE_CODES = new Set(["aborted", "cancelled", "deadline-exceeded", "internal", "resource-exhausted", "unavailable", "unknown"]);

function errorCode(value: unknown): string | null {
  if (typeof value !== "object" || value === null || !("code" in value)) return null;
  const code = (value as { readonly code?: unknown }).code;
  if (typeof code !== "string") return null;
  const slash = code.lastIndexOf("/");
  return slash >= 0 ? code.slice(slash + 1) : code;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export interface AttemptQueue {
  /** Saves attempts strictly in order, retrying network failures until the queue is closed. */
  enqueue(submission: AttemptSubmission): void;
  /** True while a save is failing; the game pauses so no answer is lost. */
  readonly blocked: boolean;
  close(): void;
}

export function createAttemptQueue(onError: (error: Error | null) => void): AttemptQueue {
  let tail: Promise<void> = Promise.resolve();
  let blocked = false;
  let open = true;

  const save = async (submission: AttemptSubmission): Promise<void> => {
    if (blocked) return;
    for (let attempt = 0; open; attempt += 1) {
      try {
        await persistGameAttempt(submission);
        blocked = false;
        if (open) onError(null);
        return;
      } catch (reason: unknown) {
        blocked = true;
        const code = errorCode(reason);
        if (code === null || !RETRYABLE_CODES.has(code)) {
          if (open) onError(reason instanceof Error ? reason : new Error("게임 결과를 저장하지 못했습니다."));
          return;
        }
        if (open) onError(new Error("네트워크 연결을 복구하는 동안 게임을 잠시 멈췄습니다."));
        await wait(RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 5_000);
      }
    }
  };

  return {
    enqueue(submission) {
      tail = tail.then(() => save(submission));
    },
    get blocked() {
      return blocked;
    },
    close() {
      open = false;
    },
  };
}
