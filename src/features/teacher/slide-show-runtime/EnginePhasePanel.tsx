import { useEffect, useRef, useState } from "react";
import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import GameHost from "../../../games/GameHost.tsx";
import { getGame } from "../../../games/registry.ts";
import { useRoundAttempts, useRoundProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import type { GameSession } from "../../../multiplayer/types.ts";
import type { ActiveSlideEngine } from "../../../slide-show/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import FreeResponseReview from "../free-response/FreeResponseReview.tsx";
import styles from "./EnginePhasePanel.module.css";

function CustomAnswers({ engine }: { readonly engine: ActiveSlideEngine }) {
  const presenter = getGame(engine.round.gameId).presentQuizQuestion;
  const source = engine.round.source;
  if (source.kind !== "custom" || !presenter) return null;
  return <Card><h2>정답 공개</h2><div className={styles.answers}>{source.items.map((item, index) => {
    const question = presenter(item, engine.round.gameConfig);
    return <div key={item.id}><b>{index + 1}</b><span>{question.prompt}</span><strong>{question.answer}</strong></div>;
  })}</div></Card>;
}

function Answering({ roomId, session, engine, onClose }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly engine: ActiveSlideEngine;
  readonly onClose: () => Promise<void>;
}) {
  const clock = useTimedGameClock(session);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState("");
  const autoCloseAttempted = useRef(false);
  const close = async (): Promise<void> => {
    setClosing(true);
    setCloseError("");
    try { await onClose(); }
    catch (value: unknown) { setCloseError(toErrorMessage(value, "답안 제출을 마감하지 못했습니다. 다시 시도해 주세요.")); }
    finally { setClosing(false); }
  };
  useEffect(() => {
    if (!clock.expired || closing || autoCloseAttempted.current) return;
    autoCloseAttempted.current = true;
    void close();
    // close() only reads stable props; re-running on its identity would retry endlessly.
  }, [clock.expired, closing]);
  return <>
    {engine.round.source.kind === "free-response" ? <Card><h2>질문</h2><p className={styles.prompt}>{engine.round.source.prompt}</p></Card> : null}
    <GameHost role="teacher" roomId={roomId} session={session} />
    {closeError ? <StatusPanel title="마감 오류" tone="error">{closeError}</StatusPanel> : null}
    <div className={styles.actions}><Button variant="accent" onClick={() => void close()} disabled={closing}>{closing ? "마감 중…" : "답안 마감"}</Button></div>
  </>;
}

function SubmissionStatus({ roomId, roundId }: { readonly roomId: string; readonly roundId: string }) {
  const participants = useRoundParticipants(roomId, roundId);
  const attempts = useRoundAttempts(roomId, roundId);
  const progress = useRoundProgress(roomId, roundId);
  const submitted = new Set([...attempts.value.map((item) => item.playerId), ...progress.value.filter((item) => item.attemptCount > 0).map((item) => item.playerId)]);
  const completed = new Set(progress.value.filter((item) => item.completedAtMs !== null).map((item) => item.playerId));
  return <Card><h2>제출 현황</h2><div className={styles.submissionGrid}>{participants.value.map((participant) => (
    <div data-submitted={submitted.has(participant.playerId)} key={participant.playerId}>
      <strong>{participant.nickname || participant.displayName}</strong>
      <span>{completed.has(participant.playerId) ? "완료" : submitted.has(participant.playerId) ? "진행 중 마감" : "미제출"}</span>
    </div>
  ))}</div></Card>;
}

/** Teacher-side detail for the engine phase shown under the slide. */
export default function EnginePhasePanel({ roomId, session, engine, onCloseAnswers, onAwardingChange }: {
  readonly roomId: string;
  readonly session: GameSession;
  readonly engine: ActiveSlideEngine;
  readonly onCloseAnswers: () => Promise<void>;
  readonly onAwardingChange: (awarding: boolean) => void;
}) {
  if (engine.phase === "answering") {
    return session.roundId === engine.roundId ? <Answering key={engine.roundId} roomId={roomId} session={session} engine={engine} onClose={onCloseAnswers} /> : null;
  }
  if (engine.phase === "submissions") {
    return <>
      {engine.round.source.kind === "free-response"
        ? <FreeResponseReview key={engine.roundId} roomId={roomId} roundId={engine.roundId} onWorkingChange={onAwardingChange} />
        : <SubmissionStatus roomId={roomId} roundId={engine.roundId} />}
      <CustomAnswers engine={engine} />
    </>;
  }
  return null;
}
