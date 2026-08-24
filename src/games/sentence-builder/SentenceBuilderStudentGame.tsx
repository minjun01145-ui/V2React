import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import StudentSentenceBuilder from "./StudentSentenceBuilder.tsx";
import { useSentenceBuilderSet } from "./useSentenceBuilderSet.ts";

export default function SentenceBuilderStudentGame({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useSentenceBuilderSet(session);
  if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">이번 게임의 문항을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <StudentSentenceBuilder roomId={roomId} session={session} player={player} set={learningSet.set} />;
}
