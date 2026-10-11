import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useRoundParticipants } from "../../multiplayer/hooks.ts";
import { useQuestionResponses } from "../../slide-question/hooks.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";

export default function SlideQuestionTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const responses = useQuestionResponses(roomId, session.roundId);
  const participants = useRoundParticipants(roomId, session.roundId);
  if (responses.error || participants.error) return <StatusPanel title="제출 현황 오류" tone="error">{responses.error?.message ?? participants.error?.message}</StatusPanel>;
  return <strong>제출 {responses.value.length}/{participants.value.length}</strong>;
}
