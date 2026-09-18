import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { belongsToTenant, effectiveTenantId } from "../shared/tenant.js";
import { tenantLearningSetsCollection } from "../shared/tenantData.js";
import { resolveAiTutorRoundContext } from "./roundContext.js";
import { AI_TUTOR_GAME_ID, POKEMON_CATCH_GAME_ID, type AiTutorDirection, type AiTutorRoundContext } from "./types.js";
import { AiTutorValidationError } from "./validation.js";

export async function loadAiTutorRoundContext(input: {
  readonly uid: string;
  readonly roomId: string;
  readonly roundId: string;
  readonly itemId: string;
  readonly requestedDirection: AiTutorDirection | null;
}): Promise<AiTutorRoundContext> {
  const sessionRef = db.collection("multiplayerSessions").doc(input.roomId);
  const [sessionSnapshot, participantSnapshot] = await Promise.all([
    sessionRef.get(),
    sessionRef.collection("rounds").doc(input.roundId).collection("participants").doc(input.uid).get(),
  ]);
  const session: unknown = sessionSnapshot.exists ? sessionSnapshot.data() : null;
  if (!isRecord(session)
    || session.status !== "playing"
    || session.roundId !== input.roundId
    || (session.gameId !== AI_TUTOR_GAME_ID && session.gameId !== POKEMON_CATCH_GAME_ID)
    || !participantSnapshot.exists) {
    throw new AiTutorValidationError("현재 참여 중인 AI 문답 라운드를 확인해주세요.");
  }
  const config = isRecord(session.gameConfig) ? session.gameConfig : null;
  const tenantId = effectiveTenantId(session.tenantId);
  const contextInput = {
    itemId: input.itemId,
    gameId: session.gameId,
    configuredDirection: config?.direction,
    requestedDirection: input.requestedDirection,
  };
  // 정답은 학생 요청이 아니라 교사가 설정한 현재 라운드에서만 읽는다.
  if (config?.set != null) {
    const set = isRecord(config.set) ? config.set : null;
    return resolveAiTutorRoundContext({ ...contextInput, setType: set?.type, items: set?.items });
  }
  const setId = config && typeof config.setId === "string" ? config.setId.trim() : "";
  if (!setId) throw new AiTutorValidationError("AI 문답에는 학습 세트 또는 직접 출제 문항이 필요합니다.");

  const setRef = tenantLearningSetsCollection(tenantId).doc(setId);
  const [metadataSnapshot, contentSnapshot] = await Promise.all([
    setRef.get(),
    setRef.collection("content").doc("main").get(),
  ]);
  const metadata: unknown = metadataSnapshot.exists ? metadataSnapshot.data() : null;
  const content: unknown = contentSnapshot.exists ? contentSnapshot.data() : null;
  if (!isRecord(metadata) || !belongsToTenant(metadata.tenantId, tenantId)) throw new AiTutorValidationError("이 사용자의 학습 세트가 아닙니다.");
  return resolveAiTutorRoundContext({
    ...contextInput,
    setType: isRecord(metadata) ? metadata.type : null,
    items: isRecord(content) ? content.items : null,
  });
}
