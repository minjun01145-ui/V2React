import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import MatchingTeacherGame from "./MatchingTeacherGame.tsx";
import { useMatchingSet } from "./useMatchingSet.ts";

export default function MatchingTeacherModule({ roomId, session }: TeacherGameModuleProps) {
  const learningSet = useMatchingSet(session);
  if (learningSet.loading) return <StatusPanel title="단어 세트 불러오는 중">게임 현황을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="단어 세트 오류" tone="error">{learningSet.error?.message ?? "선택한 단어 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <MatchingTeacherGame roomId={roomId} session={session} set={learningSet.set} />;
}
