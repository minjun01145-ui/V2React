import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { TypingPracticeBoard } from "./TypingPracticeGame.tsx";
import { useTypingSet } from "./useTypingSet.ts";
import { parseWaitingTypingConfig } from "./waitingTypingConfig.ts";

export default function AcidRainStudentGame(props: StudentGameModuleProps) {
  const learningSet = useTypingSet(props.session);
  const config = parseWaitingTypingConfig(props.session.gameConfig);
  if (learningSet.loading) return <StatusPanel title="산성비 준비 중">이번 게임의 문장을 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  if (!config) return <StatusPanel title="산성비 설정 오류" tone="error">선택된 학습 세트 정보가 없습니다.</StatusPanel>;
  return <TypingPracticeBoard set={learningSet.set as RuntimeLearningSet} config={config} liveContext={props} />;
}
