import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import LiveLeaderboard from "../../game-engine/timed-game/LiveLeaderboard.tsx";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { useAiTutorSet } from "./useAiTutorSet.ts";

export default function AiTutorTeacherGame(props: TeacherGameModuleProps) {
  const learningSet = useAiTutorSet(props.session);
  if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">AI 문답 현황을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <LiveLeaderboard roomId={props.roomId} session={props.session} title={`${learningSet.set.name} · AI 문답`} />;
}

