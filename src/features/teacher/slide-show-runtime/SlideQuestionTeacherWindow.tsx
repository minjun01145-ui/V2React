import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import type { GameSession } from "../../../multiplayer/types.ts";
import type { ActiveSlideEngine, SlideShowSessionState } from "../../../slide-show/types.ts";
import { TIMER_SKINS } from "../../../slide-show/timerSkins.ts";
import type { TimerSkin } from "../../../slide-show/timerSkins.ts";
import { useQuestionKey, useQuestionResponses } from "../../../slide-question/hooks.ts";
import type { QuestionSource } from "../../../slide-question/model.ts";
import QuestionTiles from "../../../slide-question/ui/QuestionTiles.tsx";
import QuestionResults from "../../../slide-question/ui/QuestionResults.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import EngineTimerFace from "./EngineTimerFace.tsx";
import ShowLeaderboard from "./ShowLeaderboard.tsx";
import styles from "./SlideQuestionTeacherWindow.module.css";

export default function SlideQuestionTeacherWindow({ roomId, session, slideShow, engine, source, timerSkin, onTimerSkinChange }: { readonly roomId: string; readonly session: GameSession; readonly slideShow: SlideShowSessionState; readonly engine: ActiveSlideEngine; readonly source: QuestionSource; readonly timerSkin: TimerSkin; readonly onTimerSkinChange: (skin: TimerSkin) => void }) {
  const clock = useTimedGameClock(session);
  const responses = useQuestionResponses(roomId, engine.roundId);
  const participants = useRoundParticipants(roomId, engine.roundId);
  const key = useQuestionKey(roomId, slideShow.runId, engine.slideId, source.question);
  const closed = engine.phase !== "answering" || clock.expired;
  const error = responses.error ?? participants.error ?? key.error;
  if (error) return <StatusPanel title="문제 연결 오류" tone="error">{error.message}</StatusPanel>;
  return <section className={styles.window} data-closed={closed}>
    <div className={styles.heading}><h2>{source.question.prompt}</h2>{closed ? <strong className={styles.submitted}>제출 {responses.value.length}/{participants.value.length}</strong> : null}</div>
    {!closed ? <SegmentedControl options={TIMER_SKINS} value={timerSkin} onChange={onTimerSkinChange} ariaLabel="타이머 모양" size="sm" /> : null}
    <div className={styles.middle}>
      <div className={styles.center}>{closed ? <QuestionResults question={source.question} grading={key.value} responses={responses.value} participantCount={participants.value.length} />
        : <EngineTimerFace skin={timerSkin} timer={{ remainingSeconds: Math.ceil((clock.remainingMs ?? 0) / 1000), durationSeconds: engine.round.durationSeconds, running: !clock.expired, finished: clock.expired }} />}</div>
      {!closed ? <strong className={styles.submitted}>제출 {responses.value.length}/{participants.value.length}</strong> : null}
    </div>
    {source.question.type === "multiple-choice" || source.question.type === "ox" ? <div className={styles.options}><QuestionTiles question={source.question} grading={closed ? key.value : null} /></div> : null}
    {engine.phase === "results" ? <div className={styles.ranking}><ShowLeaderboard roomId={roomId} slideShow={slideShow} /></div> : null}
  </section>;
}
