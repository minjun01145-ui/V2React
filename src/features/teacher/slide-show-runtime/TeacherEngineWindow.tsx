import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import { getGame } from "../../../games/registry.ts";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { useRoundProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import type { GameSession } from "../../../multiplayer/types.ts";
import type { ActiveSlideEngine, SlideEngineRound, SlideShowSessionState } from "../../../slide-show/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import { TIMER_SKINS, type TimerSkin } from "../../../slide-show/timerSkins.ts";
import EngineTimerFace from "./EngineTimerFace.tsx";
import SlideQuestionTeacherWindow from "./SlideQuestionTeacherWindow.tsx";
import ShowLeaderboard from "./ShowLeaderboard.tsx";
import styles from "./TeacherEngineWindow.module.css";

function AnsweringCard({ roomId, session, engine, timerSkin, onTimerSkinChange }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly engine: ActiveSlideEngine;
  readonly timerSkin: TimerSkin;
  readonly onTimerSkinChange: (skin: TimerSkin) => void;
}) {
  const clock = useTimedGameClock(session);
  const participants = useRoundParticipants(roomId, engine.roundId);
  const progress = useRoundProgress(roomId, engine.roundId);
  const done = progress.value.filter((item) => item.completedAtMs !== null || item.attemptCount > 0).length;
  const seconds = clock.remainingMs === null ? null : Math.ceil(clock.remainingMs / 1_000);
  if (engine.round.gameId === "free-response" && seconds !== null) return <div className={`${styles.card} ${styles.timerCard}`} data-urgent={seconds <= 5}>
    <div className={styles.timerHeader}>
      <span>{getGame(engine.round.gameId).title}</span>
      <SegmentedControl options={TIMER_SKINS} value={timerSkin} onChange={onTimerSkinChange} ariaLabel="타이머 모양" size="sm" />
      <em>참여 {done}/{participants.value.length}</em>
    </div>
    <EngineTimerFace skin={timerSkin} timer={{ remainingSeconds: seconds, durationSeconds: engine.round.durationSeconds, running: !clock.expired, finished: clock.expired }} />
  </div>;
  return <div className={styles.card} data-urgent={seconds !== null && seconds <= 5}>
    <span>{getGame(engine.round.gameId).title}</span>
    <strong>{seconds ?? "—"}</strong>
    <em>참여 {done}/{participants.value.length}</em>
  </div>;
}

function ActiveEngine({ roomId, session, slideShow, engine, timerSkin, onTimerSkinChange }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly slideShow: SlideShowSessionState;
  readonly engine: ActiveSlideEngine;
  readonly timerSkin: TimerSkin;
  readonly onTimerSkinChange: (skin: TimerSkin) => void;
}) {
  if (session.status === SESSION_STATUS.PREPARING) return <div className={styles.card}><span>{getGame(engine.round.gameId).title}</span><strong className={styles.small}>학생 접속 확인 중</strong></div>;
  if (engine.round.source.kind === "slide-question") return <SlideQuestionTeacherWindow roomId={roomId} session={session} slideShow={slideShow} engine={engine} source={engine.round.source} timerSkin={timerSkin} onTimerSkinChange={onTimerSkinChange} />;
  if (engine.phase === "answering") return <AnsweringCard roomId={roomId} session={session} engine={engine} timerSkin={timerSkin} onTimerSkinChange={onTimerSkinChange} />;
  if (engine.phase === "submissions") return <div className={styles.card}><span>{getGame(engine.round.gameId).title}</span><strong className={styles.small}>제출 마감!</strong></div>;
  return <div className={styles.ranking}><ShowLeaderboard roomId={roomId} slideShow={slideShow} /></div>;
}

/** What the teacher sees inside the slide's engine window: the start button, then the live round. */
export default function TeacherEngineWindow({ roomId, session, slideShow, round, engine, starting, onStart, timerSkin, onTimerSkinChange }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly slideShow: SlideShowSessionState;
  readonly round: SlideEngineRound;
  /** The running engine on this slide, or null before it starts. */
  readonly engine: ActiveSlideEngine | null;
  readonly starting: boolean;
  readonly onStart: () => void;
  readonly timerSkin: TimerSkin;
  readonly onTimerSkinChange: (skin: TimerSkin) => void;
}) {
  if (engine) return <ActiveEngine roomId={roomId} session={session} slideShow={slideShow} engine={engine} timerSkin={timerSkin} onTimerSkinChange={onTimerSkinChange} />;
  return <div className={styles.card}>
    <span>{getGame(round.gameId).title}</span>
    <Button variant="accent" size="lg" className={styles.start} onClick={onStart} disabled={starting}>{starting ? "시작하는 중…" : "문제 시작"}</Button>
  </div>;
}
