import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import AcidRainLeaderboard from "./AcidRainLeaderboard.tsx";
import { useTypingSet } from "./useTypingSet.ts";

export default function AcidRainTeacherGame(props: TeacherGameModuleProps) {
  const learningSet = useTypingSet(props.session);
  if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">산성비 게임 문장을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  const set = learningSet.set as RuntimeLearningSet;
  return <AcidRainLeaderboard roomId={props.roomId} session={props.session} title={`${set.name} · 산성비 타자게임`} />;
}
