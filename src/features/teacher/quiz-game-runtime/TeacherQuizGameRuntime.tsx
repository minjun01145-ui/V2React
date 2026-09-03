import { useEffect, useMemo, useState } from "react";
import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import GameHost from "../../../games/GameHost.tsx";
import { getGame } from "../../../games/registry.ts";
import { useRoundAttempts, useRoundProgress } from "../../../multiplayer/game-progress/hooks.ts";
import { loadRoundProgress } from "../../../multiplayer/game-progress/repository.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import { advanceQuizGame, setQuizGamePhase } from "../../../multiplayer/repository.ts";
import type { GameSession } from "../../../multiplayer/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./TeacherQuizGameRuntime.module.css";

function QuizAnswering({ roomId, session, onClosed }: { readonly roomId: string; readonly session: GameSession; readonly onClosed: () => Promise<void> }) {
  const clock = useTimedGameClock(session);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!clock.expired || closing) return;
    setClosing(true);
    void onClosed().finally(() => setClosing(false));
  }, [clock.expired, closing, onClosed]);
  return <><GameHost role="teacher" roomId={roomId} session={session} /><Button onClick={() => void onClosed()} disabled={closing}>{closing ? "마감 중…" : "답안 제출 마감"}</Button></>;
}

function SubmissionStatus({ roomId, session }: { readonly roomId: string; readonly session: GameSession }) {
  const participants = useRoundParticipants(roomId, session.roundId ?? "");
  const attempts = useRoundAttempts(roomId, session.roundId ?? "");
  const progress = useRoundProgress(roomId, session.roundId ?? "");
  const submitted = new Set([...attempts.value.map((item) => item.playerId), ...progress.value.filter((item) => item.attemptCount > 0).map((item) => item.playerId)]);
  return <Card><h2>답안 제출 현황</h2><div className={styles.submissionGrid}>{participants.value.map((participant) => <div data-submitted={submitted.has(participant.playerId)} key={participant.playerId}><strong>{participant.nickname || participant.displayName}</strong><span>{submitted.has(participant.playerId) ? "제출" : "미제출"}</span></div>)}</div></Card>;
}

interface RankingEntry { readonly playerId: string; readonly displayName: string; readonly score: number; readonly correctCount: number; readonly attemptCount: number; }

function CumulativeLeaderboard({ roomId, session }: { readonly roomId: string; readonly session: GameSession }) {
  const [entries, setEntries] = useState<readonly RankingEntry[]>([]);
  const [error, setError] = useState("");
  const roundIds = session.quizGame?.roundIds ?? [];
  const scope = roundIds.join(":");
  useEffect(() => {
    let active = true;
    void Promise.all(roundIds.map((roundId) => loadRoundProgress(roomId, roundId))).then((rounds) => {
      if (!active) return;
      const totals = new Map<string, RankingEntry>();
      for (const item of rounds.flat()) {
        const current = totals.get(item.playerId);
        totals.set(item.playerId, { playerId: item.playerId, displayName: item.displayName, score: (current?.score ?? 0) + item.score, correctCount: (current?.correctCount ?? 0) + item.correctCount, attemptCount: (current?.attemptCount ?? 0) + item.attemptCount });
      }
      setEntries([...totals.values()].sort((a, b) => b.score - a.score || b.correctCount - a.correctCount));
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "누적 순위를 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, [roomId, scope]);
  if (error) return <StatusPanel title="리더보드 오류" tone="error">{error}</StatusPanel>;
  return <Card><h2>현재까지 리더보드</h2><div className={styles.ranking}>{entries.length === 0 ? <p>아직 저장된 점수가 없습니다.</p> : entries.map((entry, index) => <div key={entry.playerId}><b>{index + 1}</b><strong>{entry.displayName}</strong><span>{entry.correctCount}/{entry.attemptCount}</span><em>{entry.score.toLocaleString("ko-KR")}점</em></div>)}</div></Card>;
}

export default function TeacherQuizGameRuntime({ roomId, session }: { readonly roomId: string; readonly session: GameSession }) {
  const quiz = session.quizGame;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const round = quiz?.plan.rounds[quiz.currentRoundIndex];
  const closeAnswers = useMemo(() => async (): Promise<void> => {
    if (!session.roundId) return;
    await setQuizGamePhase(roomId, session.roundId, "submissions");
  }, [roomId, session.roundId]);
  if (!quiz || !round) return <StatusPanel title="퀴즈 상태 오류" tone="error">실행 중인 퀴즈 라운드를 찾을 수 없습니다.</StatusPanel>;
  const run = async (action: () => Promise<void>): Promise<void> => { if (working) return; setWorking(true); setError(""); try { await action(); } catch (value: unknown) { setError(toErrorMessage(value, "퀴즈 단계를 변경하지 못했습니다.")); } finally { setWorking(false); } };
  return <section className={styles.runtime}>
    <header className={styles.header}><div><span>QUIZ GAME · {quiz.currentRoundIndex + 1}/{quiz.plan.rounds.length}</span><h1>{round.title}</h1><p>{getGame(round.gameId).title} · {round.durationSeconds}초</p></div></header>
    {error ? <StatusPanel title="퀴즈 진행 오류" tone="error">{error}</StatusPanel> : null}
    {quiz.phase === "answering" ? <QuizAnswering roomId={roomId} session={session} onClosed={closeAnswers} /> : null}
    {quiz.phase === "submissions" ? <><SubmissionStatus roomId={roomId} session={session} /><Button disabled={working} onClick={() => void run(() => setQuizGamePhase(roomId, session.roundId ?? "", "leaderboard"))}>리더보드 보기</Button></> : null}
    {quiz.phase === "leaderboard" ? <><CumulativeLeaderboard roomId={roomId} session={session} /><Button disabled={working} onClick={() => void run(() => advanceQuizGame(roomId))}>{quiz.currentRoundIndex + 1 < quiz.plan.rounds.length ? "다음 문제" : "퀴즈 종료"}</Button></> : null}
    {quiz.phase === "complete" ? <><CumulativeLeaderboard roomId={roomId} session={session} /><StatusPanel title="퀴즈 종료">대기실로 돌아가면 새 게임을 시작할 수 있습니다.</StatusPanel></> : null}
  </section>;
}
