import { useFreeResponse } from "../../free-response/hooks.ts";
import { submitFreeResponse } from "../../free-response/repository.ts";
import FreeResponseForm from "../../free-response/ui/FreeResponseForm.tsx";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { TimedGameStatus } from "../../game-engine/timed-game/TimedGameStatus.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";

export default function FreeResponseStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const response = useFreeResponse(roomId, session.roundId, player.id);
  const clock = useTimedGameClock(session);
  const prompt = typeof session.gameConfig?.freeResponsePrompt === "string" ? session.gameConfig.freeResponsePrompt : "";
  if (!prompt) return <StatusPanel title="질문 정보 오류" tone="error">자유 답안 질문을 찾을 수 없습니다.</StatusPanel>;
  if (response.error) return <StatusPanel title="답안 연결 오류" tone="error">{response.error.message}</StatusPanel>;
  if (response.loading) return <StatusPanel title="답안 불러오는 중">이전에 제출한 답안을 확인하고 있습니다.</StatusPanel>;
  return <><TimedGameStatus session={session} /><FreeResponseForm key={session.roundId} prompt={prompt} submittedAnswer={response.value?.answer ?? null} closed={clock.expired} onSubmit={(answer) => submitFreeResponse(roomId, session.roundId, answer)} /></>;
}
