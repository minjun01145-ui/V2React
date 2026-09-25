import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import AiTutorPlayView from "./AiTutorPlayView.tsx";
import { useAiTutorGame } from "./useAiTutorGame.ts";
import { useAiTutorSet } from "./useAiTutorSet.ts";

function AiTutorPlayArea(props: StudentGameModuleProps & {
  readonly set: NonNullable<ReturnType<typeof useAiTutorSet>["set"]>;
}) {
  const game = useAiTutorGame({ roomId: props.roomId, session: props.session, player: props.player, set: props.set });
  return <AiTutorPlayView game={game} />;
}

export default function AiTutorStudentGame(props: StudentGameModuleProps) {
  const learningSet = useAiTutorSet(props.session);
  if (learningSet.loading) {
    return <StatusPanel title="학습 세트 불러오는 중">AI 문답 문제를 준비하고 있습니다.</StatusPanel>;
  }
  if (learningSet.error || !learningSet.set) {
    return <StatusPanel title="학습 세트 오류" tone="error">
      {learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}
    </StatusPanel>;
  }
  return <AiTutorPlayArea {...props} set={learningSet.set} />;
}
