import { useEffect, useRef, useState } from "react";
import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import { getGame } from "../../../games/registry.ts";
import { SESSION_STATUS } from "../../../multiplayer/constants.ts";
import { useRoundProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import type { GameSession, Player } from "../../../multiplayer/types.ts";
import { awardShowPoints, closeShowEngine, goToShowSlide, setShowEnginePhase, startShowSlideEngine } from "../../../slide-show/multiplayerService.ts";
import type { ActiveSlideEngine, SlideShowSessionState } from "../../../slide-show/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import SlideViewport from "../../slide-show-runtime/SlideViewport.tsx";
import { useShowRunSlides } from "../../slide-show-runtime/useShowRunSlides.ts";
import AwardPanel from "./AwardPanel.tsx";
import EnginePhasePanel from "./EnginePhasePanel.tsx";
import ShowLeaderboard from "./ShowLeaderboard.tsx";
import StudentPickerPanel from "./StudentPickerPanel.tsx";
import TimerPanel from "./timer/TimerPanel.tsx";
import { formatTimerSeconds } from "./timer/model.ts";
import { useCountdownTimer } from "./timer/useCountdownTimer.ts";
import styles from "./TeacherSlideShowRuntime.module.css";

type SidePanel = "award" | "ranking" | "picker" | "timer" | null;

function AnsweringCard({ roomId, session, engine }: { readonly roomId: string; readonly session: GameSession; readonly engine: ActiveSlideEngine }) {
  const clock = useTimedGameClock(session);
  const participants = useRoundParticipants(roomId, engine.roundId);
  const progress = useRoundProgress(roomId, engine.roundId);
  const done = progress.value.filter((item) => item.completedAtMs !== null || item.attemptCount > 0).length;
  const seconds = clock.remainingMs === null ? null : Math.ceil(clock.remainingMs / 1_000);
  return <div className={styles.engineCard} data-urgent={seconds !== null && seconds <= 5}>
    <span>{getGame(engine.round.gameId).title}</span>
    <strong>{seconds ?? "—"}</strong>
    <em>참여 {done}/{participants.value.length}</em>
  </div>;
}

function TeacherEngineContent({ roomId, session, slideShow, engine }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly slideShow: SlideShowSessionState;
  readonly engine: ActiveSlideEngine;
}) {
  if (session.status === SESSION_STATUS.PREPARING) return <div className={styles.engineCard}><span>{getGame(engine.round.gameId).title}</span><strong className={styles.small}>학생 접속 확인 중</strong></div>;
  if (engine.phase === "answering") return <AnsweringCard roomId={roomId} session={session} engine={engine} />;
  if (engine.phase === "submissions") return <div className={styles.engineCard}><span>{getGame(engine.round.gameId).title}</span><strong className={styles.small}>제출 마감!</strong></div>;
  return <div className={styles.rankingWindow}><ShowLeaderboard roomId={roomId} slideShow={slideShow} /></div>;
}

/** Presenter view: the projected slide, navigation, the slide's question engine and show scoring. */
export default function TeacherSlideShowRuntime({ roomId, session, slideShow, players }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly slideShow: SlideShowSessionState;
  readonly players: readonly Player[];
}) {
  const { slides, loading, error: loadError } = useShowRunSlides(roomId, slideShow.runId);
  const [working, setWorking] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [panel, setPanel] = useState<SidePanel>(null);
  const [error, setError] = useState("");
  const fullscreenRef = useRef<HTMLElement | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const timer = useCountdownTimer();
  const index = slideShow.currentSlideIndex;
  const slide = slides.get(slideShow.slideIds[index] ?? "");
  const engine = slideShow.engine;
  const currentEngine = engine?.slideId === slide?.id ? engine : null;
  const lastIndex = slideShow.slideIds.length - 1;

  const run = async (action: () => Promise<void>, fallback: string): Promise<void> => {
    if (working) return;
    setWorking(true);
    setError("");
    try { await action(); }
    catch (value: unknown) { setError(toErrorMessage(value, fallback)); }
    finally { setWorking(false); }
  };
  const go = (target: number): void => {
    if (engine || target < 0 || target > lastIndex || target === index) return;
    void run(() => goToShowSlide(roomId, target), "슬라이드를 넘기지 못했습니다.");
  };

  // Clicker and keyboard navigation, as in presentation software.
  const goRef = useRef(go);
  goRef.current = go;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLElement) {
        if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
        if (event.key === " " && event.target.closest("button")) return;
      }
      if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); goRef.current(index + 1); }
      if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); goRef.current(index - 1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index]);

  useEffect(() => {
    const onChange = (): void => setFullscreen(document.fullscreenElement === fullscreenRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async (): Promise<void> => {
    try {
      if (document.fullscreenElement === fullscreenRef.current) await document.exitFullscreen();
      else await fullscreenRef.current?.requestFullscreen();
    } catch (cause: unknown) {
      setError(toErrorMessage(cause, "전체화면으로 전환하지 못했습니다."));
    }
  };

  const engineControls = !engine
    ? slide?.engine ? <Button variant="accent" onClick={() => void run(() => startShowSlideEngine(roomId), "문제를 시작하지 못했습니다.")} disabled={working}>문제 시작</Button> : null
    : <>
      {engine.phase === "submissions" ? <Button variant="accent" onClick={() => void run(() => setShowEnginePhase(roomId, "results"), "결과를 열지 못했습니다.")} disabled={working || awarding}>결과 보기</Button> : null}
      {engine.phase === "results"
        ? <Button variant="accent" onClick={() => void run(() => closeShowEngine(roomId), "슬라이드로 돌아가지 못했습니다.")} disabled={working}>슬라이드로</Button>
        : <Button variant="ghost" onClick={() => void run(() => closeShowEngine(roomId), "문제를 닫지 못했습니다.")} disabled={working || awarding}>문제 닫기</Button>}
    </>;

  return <section ref={fullscreenRef} className={styles.runtime} data-has-panels={Boolean(panel || engine || error)} aria-label="슬라이드쇼 교사화면">
      <div className={styles.stage}>
        {loadError ? <StatusPanel title="슬라이드를 불러오지 못했습니다" tone="error">{loadError.message}</StatusPanel>
          : loading || !slide ? <StatusPanel title="슬라이드를 불러오는 중" tone="waiting">잠시만 기다려 주세요.</StatusPanel>
          : <SlideViewport
            slide={slide}
            engineFrame={currentEngine?.frame ?? slide.engine?.frame ?? null}
            engineContent={currentEngine ? <TeacherEngineContent roomId={roomId} session={session} slideShow={slideShow} engine={currentEngine} /> : slide.engine ? <div className={styles.engineCard}><span>게임엔진</span><strong className={styles.small}>{getGame(slide.engine.round.gameId).title}</strong><em>시작 대기</em></div> : null}
          />}
      </div>
      <div className={styles.controls}>
        <div className={styles.nav}>
          <Button variant="ghost" aria-label="이전 슬라이드" onClick={() => go(index - 1)} disabled={working || Boolean(engine) || index === 0}>◀</Button>
          <strong>{index + 1} / {slideShow.slideIds.length}</strong>
          <Button variant="ghost" aria-label="다음 슬라이드" onClick={() => go(index + 1)} disabled={working || Boolean(engine) || index === lastIndex}>▶</Button>
        </div>
        <div className={styles.engineControls}>{engineControls}</div>
        <div className={styles.tools}>
          <Button variant={panel === "award" ? "primary" : "ghost"} onClick={() => setPanel(panel === "award" ? null : "award")}>점수 주기</Button>
          <Button variant={panel === "ranking" ? "primary" : "ghost"} onClick={() => setPanel(panel === "ranking" ? null : "ranking")}>순위</Button>
          <Button variant={panel === "picker" ? "primary" : "ghost"} onClick={() => setPanel(panel === "picker" ? null : "picker")}>학생 뽑기</Button>
          <Button className={styles.timerButton} variant={panel === "timer" ? "primary" : "ghost"} onClick={() => setPanel(panel === "timer" ? null : "timer")}>타이머 {formatTimerSeconds(timer.remainingSeconds)}</Button>
          <Button variant="ghost" onClick={() => void toggleFullscreen()}>{fullscreen ? "전체화면 종료" : "전체 화면"}</Button>
        </div>
      </div>
    <div className={styles.panels}>
      {error ? <StatusPanel title="슬라이드쇼 진행 오류" tone="error">{error}</StatusPanel> : null}
      {panel === "award" ? <Card><AwardPanel players={players} awards={slideShow.awards} disabled={working} onAward={(playerIds, points) => run(() => awardShowPoints(roomId, playerIds, points), "점수를 주지 못했습니다.")} /></Card> : null}
      {panel === "ranking" ? <Card><ShowLeaderboard roomId={roomId} slideShow={slideShow} /></Card> : null}
      {panel === "picker" ? <Card><StudentPickerPanel roomId={roomId} players={players} /></Card> : null}
      {panel === "timer" ? <Card><TimerPanel timer={timer} /></Card> : null}
      {engine ? <EnginePhasePanel roomId={roomId} session={session} engine={engine} onCloseAnswers={() => setShowEnginePhase(roomId, "submissions")} onAwardingChange={setAwarding} /> : null}
    </div>
  </section>;
}
