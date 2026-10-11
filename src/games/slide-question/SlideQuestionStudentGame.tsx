import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useQuestionResponses } from "../../slide-question/hooks.ts";
import { parseQuestion } from "../../slide-question/model.ts";
import { submitQuestion } from "../../slide-question/repository.ts";
import QuestionStudentView from "../../slide-question/ui/QuestionStudentView.tsx";
import StatusPanel from "../../shared/StatusPanel.tsx";

export default function SlideQuestionStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const responses = useQuestionResponses(roomId, session.roundId, player.id);
  const clock = useTimedGameClock(session);
  const question = parseQuestion(session.gameConfig?.slideQuestion);
  if (!question) return <StatusPanel title="문제 정보 오류" tone="error">문제를 찾을 수 없습니다.</StatusPanel>;
  if (responses.error) return <StatusPanel title="답안 연결 오류" tone="error">{responses.error.message}</StatusPanel>;
  return <QuestionStudentView key={session.roundId} question={question} response={responses.value[0] ?? null} loading={responses.loading} closed={clock.expired} onSubmit={(answer) => submitQuestion(roomId, session.roundId, answer)} />;
}
