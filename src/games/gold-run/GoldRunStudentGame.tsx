import { useMemo, useRef, useState } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { ImmersiveStage } from "../../game-engine/stage/ImmersiveStage.tsx";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import { useLearningSet } from "../../learning-sets/useLearningSet.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import GoldRunHud from "./GoldRunHud.tsx";
import GoldRunStage from "./GoldRunStage.tsx";
import { buildGoldRunQuestions } from "./model/questions.ts";
import type { GoldRunHud as HudState } from "./scene/GoldRunScene.ts";
import { useGoldRun } from "./useGoldRun.ts";
import styles from "./GoldRun.module.css";

export default function GoldRunStudentGame(props: StudentGameModuleProps) {
  const setId = props.session.gameConfig?.setId;
  const learningSet = useLearningSet(typeof setId === "string" ? setId : null, props.session.roundId);
  if (learningSet.loading) return <StatusPanel title="금광 가는 중">학습 세트를 불러오고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "학습 세트를 선택해 주세요."}</StatusPanel>;
  return <LoadedGame key={`${props.session.roundId}:${props.player.id}`} {...props} set={learningSet.set} />;
}

function LoadedGame(props: StudentGameModuleProps & { readonly set: RuntimeLearningSet }) {
  const clock = useTimedGameClock(props.session);
  const questions = useMemo(() => buildGoldRunQuestions(props.set, props.session.gameConfig ?? {}, props.session.roundId),
    [props.set, props.session.gameConfig, props.session.roundId]);
  const game = useGoldRun({ ...props, questions });
  const [hud, setHud] = useState<HudState | null>(null);
  const [muted, setMuted] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  if (!game.ready && !game.error) return <StatusPanel title="출발 준비 중">진행 기록을 불러오고 있습니다.</StatusPanel>;
  return <ImmersiveStage>
    <div ref={shell} className={styles.shell}>
      <GoldRunStage seed={props.session.roundId} playerId={props.player.id} running={!game.blocked && !clock.expired}
        muted={muted} isTrue={game.isTrue} onGate={game.onGate} onHud={setHud} />
      <GoldRunHud hud={hud} startScore={game.startScore} question={game.questionAt(hud?.gate.question ?? 0)} feedback={game.feedback}
        remainingMs={clock.remainingMs} expired={clock.expired} muted={muted} onMute={() => setMuted(!muted)}
        error={game.error} onRetry={() => void game.retry()} fullscreenTarget={shell} />
    </div>
  </ImmersiveStage>;
}
