import { httpsCallable } from "firebase/functions";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { GameProgress } from "../../game-engine/progress/index.ts";
import { db, auth, functions } from "../../firebase/firebaseClient.ts";
import type { TenantId } from "../../tenant/scope.ts";
import type { SoloFinishResult, SoloRun } from "../contracts.ts";
import { soloRunProgressPath } from "../domain/path.ts";
import type { AiTutorDirection, AiTutorReply } from "../../ai-tutor-engine/types.ts";
import { parseAiTutorReply } from "../../ai-tutor-engine/validation.ts";

const progressRef = (run: SoloRun) => doc(db, soloRunProgressPath(run.tenantId, run.runId, run.ownerUid));

export async function startSoloRun(input: {
  readonly tenantId: TenantId;
  readonly gameId: string;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly nickname: string | null;
}): Promise<SoloRun> {
  if (!auth.currentUser) throw new Error("학생 로그인이 필요합니다.");
  const request = { ...input, startRequestId: globalThis.crypto.randomUUID() };
  const call = httpsCallable<typeof request, SoloRun>(functions, "startSoloRun");
  const response = await call(request);
  return response.data;
}

export async function loadSoloRunProgress<TDetails>(run: SoloRun): Promise<GameProgress<TDetails> | null> {
  assertRunOwner(run);
  const snapshot = await getDoc(progressRef(run));
  return snapshot.exists() ? snapshot.data() as GameProgress<TDetails> : null;
}

export async function persistSoloRunProgress<TDetails>(run: SoloRun, progress: GameProgress<TDetails>): Promise<void> {
  assertRunOwner(run);
  await setDoc(progressRef(run), { ...progress, updatedAt: serverTimestamp(), updatedAtMs: Date.now() });
}

export async function submitSoloRunAnswer<TDetails>(
  run: SoloRun,
  submission: {
    readonly currentIndex: number;
    readonly questionId: string;
    readonly itemId: string;
    readonly selectedOptionId: string;
    readonly selectedOptionText: string;
  },
): Promise<GameProgress<TDetails>> {
  assertRunOwner(run);
  const input = { runId: run.runId, gameId: run.gameId, ...submission };
  const call = httpsCallable<typeof input, GameProgress<TDetails>>(functions, "submitSoloAnswer");
  const progress = (await call(input)).data;
  await persistSoloRunProgress(run, progress);
  return progress;
}

export async function submitSoloSequenceAnswer<TDetails>(run: SoloRun, submission: {
  readonly attemptId: string;
  readonly currentIndex: number;
  readonly questionId: string;
  readonly itemId: string;
  readonly tokenIds: readonly string[];
}): Promise<GameProgress<TDetails>> {
  assertRunOwner(run);
  if (run.gameId !== "sentence-builder") throw new Error("문장 만들기 Solo run이 아닙니다.");
  const input = { runId: run.runId, gameId: run.gameId, ...submission };
  const call = httpsCallable<typeof input, GameProgress<TDetails>>(functions, "submitSoloAnswer");
  const progress = (await call(input)).data;
  await persistSoloRunProgress(run, progress);
  return progress;
}

export async function submitSoloAiTutorTurn(run: SoloRun, input: {
  readonly attemptId: string;
  readonly questionId: string;
  readonly itemId: string;
  readonly currentIndex: number;
  readonly direction?: AiTutorDirection;
  readonly message: string;
}): Promise<{ readonly reply: AiTutorReply; readonly progress: GameProgress }> {
  assertRunOwner(run);
  if (run.gameId !== "ai-tutor" && run.gameId !== "pokemon-catch") throw new Error("AI 문답을 사용할 수 없는 Solo run입니다.");
  const request = { runId: run.runId, gameId: run.gameId, ...input };
  const call = httpsCallable<typeof request, { readonly reply: unknown; readonly progress: GameProgress }>(functions, "submitSoloAiTutorTurn");
  const response = (await call(request)).data;
  const reply = parseAiTutorReply(response.reply);
  await persistSoloRunProgress(run, response.progress);
  return { reply, progress: response.progress };
}

export async function finishSoloRun(run: SoloRun): Promise<SoloFinishResult> {
  assertRunOwner(run);
  const call = httpsCallable<{ readonly runId: string; readonly gameId: string }, SoloFinishResult>(functions, "finishSoloRun");
  return (await call({ runId: run.runId, gameId: run.gameId })).data;
}

export async function abandonSoloRun(run: SoloRun): Promise<void> {
  if (auth.currentUser?.uid !== run.ownerUid) return;
  const call = httpsCallable<{ readonly runId: string }, { readonly status: string }>(functions, "abandonSoloRun");
  await call({ runId: run.runId });
}

function assertRunOwner(run: SoloRun): void {
  if (!auth.currentUser || auth.currentUser.uid !== run.ownerUid) throw new Error("본인 Solo run만 저장할 수 있습니다.");
  if (!run.runId || run.runId.includes("/")) throw new Error("Solo run ID가 올바르지 않습니다.");
}
