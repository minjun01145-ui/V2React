import type { ActiveSlideEngine } from "../../../slide-show/types.ts";
import { useQuestionResponses } from "../../../slide-question/hooks.ts";
import QuestionStudentView from "../../../slide-question/ui/QuestionStudentView.tsx";
import { submitQuestion } from "../../../slide-question/repository.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";

export default function SlideQuestionOutcome({ roomId, playerId, engine }: { readonly roomId: string; readonly playerId: string; readonly engine: ActiveSlideEngine }) {
  const responses = useQuestionResponses(roomId, engine.roundId, playerId);
  if (engine.round.source.kind !== "slide-question") return null;
  if (responses.error) return <StatusPanel title="결과 연결 오류" tone="error">{responses.error.message}</StatusPanel>;
  return <QuestionStudentView question={engine.round.source.question} response={responses.value[0] ?? null} closed loading={responses.loading} onSubmit={(answer) => submitQuestion(roomId, engine.roundId, answer)} />;
}
