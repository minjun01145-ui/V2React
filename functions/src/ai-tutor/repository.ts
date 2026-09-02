import { db } from "../shared/firebase.js";
import { isRecord } from "../shared/validation.js";
import { AI_TUTOR_GAME_ID, POKEMON_CATCH_GAME_ID, type AiTutorDirection, type AiTutorLearningItem, type AiTutorRoundContext, type AiTutorSetType } from "./types.js";
import { AiTutorValidationError } from "./validation.js";

function direction(value: unknown): AiTutorDirection {
  return value === "meaning-to-source" ? value : "source-to-meaning";
}

function setType(value: unknown): AiTutorSetType | null {
  return value === "vocabulary" || value === "reading-chunks" ? value : null;
}

function parseItem(value: unknown): AiTutorLearningItem | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id.trim() : "";
  const sourceText = typeof value.sourceText === "string" ? value.sourceText.trim() : "";
  const meaning = typeof value.meaning === "string" ? value.meaning.trim() : "";
  return id && sourceText && meaning ? { id, sourceText, meaning } : null;
}

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
  const setId = config && typeof config.setId === "string" ? config.setId.trim() : "";
  if (!setId) throw new AiTutorValidationError("AI 문답에는 저장된 학습 세트가 필요합니다.");

  const [metadataSnapshot, contentSnapshot] = await Promise.all([
    db.collection("learningSets").doc(setId).get(),
    db.collection("learningSets").doc(setId).collection("content").doc("main").get(),
  ]);
  const metadata: unknown = metadataSnapshot.exists ? metadataSnapshot.data() : null;
  const content: unknown = contentSnapshot.exists ? contentSnapshot.data() : null;
  const type = isRecord(metadata) ? setType(metadata.type) : null;
  const items = isRecord(content) && Array.isArray(content.items) ? content.items : [];
  const item = items.map(parseItem).find((candidate) => candidate?.id === input.itemId) ?? null;
  if (!type || !item) throw new AiTutorValidationError("선택한 학습 세트의 문항을 찾을 수 없습니다.");
  const resolvedDirection = session.gameId === POKEMON_CATCH_GAME_ID
    ? input.requestedDirection ?? "source-to-meaning"
    : direction(config?.direction);
  return { setType: type, direction: resolvedDirection, item };
}
