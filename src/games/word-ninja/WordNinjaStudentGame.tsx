import { useMemo } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import { buildNinjaQuestions } from "./model.ts";
import { useWordNinja } from "./useWordNinja.ts";
import WordNinjaPlay from "./WordNinjaPlay.tsx";

export default function WordNinjaStudentGame(props: StudentGameModuleProps) {
  const setId = props.session.gameConfig?.setId;
  const learningSet = useLearningSet(typeof setId === "string" ? setId : null, props.session.roundId);
  if (learningSet.loading) return <StatusPanel title="칼 가는 중">학습 세트를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "학습 세트를 선택해 주세요."}</StatusPanel>;
  return <LoadedGame key={`${props.session.roundId}:${props.player.id}`} {...props} set={learningSet.set} />;
}

function LoadedGame(props: StudentGameModuleProps & { readonly set: RuntimeLearningSet }) {
  const clock = useTimedGameClock(props.session);
  const questions = useMemo(() => buildNinjaQuestions(props.set, props.session.gameConfig ?? {}, props.session.roundId), [props.set, props.session.gameConfig, props.session.roundId]);
  const game = useWordNinja({ ...props, questions, expired: clock.expired });
  if (!game.ready && !game.error) return <StatusPanel title="과일 준비 중">진행 기록을 불러오고 있습니다.</StatusPanel>;
  return <ImmersiveStage><WordNinjaPlay questions={questions} progress={game.progress} blocked={game.blocked}
    seed={props.session.roundId} remainingMs={clock.remainingMs} expired={clock.expired} pending={game.pending} error={game.error}
    onSlice={game.slice} onRetry={() => void game.retry()} /></ImmersiveStage>;
}
