import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { useMatchingAllSet } from "./useMatchingAllSet.ts";

export default function MatchingAllTeacherModule({ roomId, session }: TeacherGameModuleProps) {
  const learningSet = useMatchingAllSet(session);
  if (learningSet.loading) return <StatusPanel title="단어 세트 불러오는 중">게임 현황을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="단어 세트 오류" tone="error">{learningSet.error?.message ?? "선택한 단어 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <LiveLeaderboard roomId={roomId} session={session} title={`${learningSet.set.name} · 짝맞추기(모든카드)`} />;
}
