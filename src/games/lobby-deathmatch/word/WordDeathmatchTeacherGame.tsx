import { useEffect, useRef, useState } from "react";
import type { TeacherGameModuleProps } from "../../../game-engine/contracts/gameDefinition.ts";
import { FullscreenToggle } from "../../../game-engine/stage/ImmersiveStage.tsx";
import { TimedGameStatus } from "../../../game-engine/timed-game/TimedGameStatus.tsx";
import { TimedResultsOverlay } from "../../../game-engine/timed-game/TimedResultsOverlay.tsx";
import { useTimedGameClock } from "../../../game-engine/timed-game/useTimedGameClock.ts";
import { createLiveRecords, type LiveRecord } from "../../../live-world/client.ts";
import { useRoundParticipants } from "../../../multiplayer/hooks.ts";
import { displayLabel } from "../../../multiplayer/types.ts";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { WORD_DEATHMATCH_CHANNEL } from "./model.ts";
import { useWordQuiz, useWordRoundClock } from "./useWordDeathmatch.ts";
import { WordQuestionHud } from "./WordQuestionHud.tsx";
import styles from "./WordDeathmatch.module.css";

/** The teacher screen shows the current question and the live ranking; students play the arena. */
export default function WordDeathmatchTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const prepared = useWordQuiz(session);
  const participants = useRoundParticipants(roomId, session.roundId);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const timed = useTimedGameClock(session);
  const endsAtMs = session.startedAtMs !== null && timed.config.durationMs !== null ? session.startedAtMs + timed.config.durationMs : null;
  const clock = useWordRoundClock(session.startedAtMs, endsAtMs);
  const [records, setRecords] = useState<readonly LiveRecord[]>([]);

  useEffect(() => {
    const board = createLiveRecords({ roomId, roundId: session.roundId, channelId: `${WORD_DEATHMATCH_CHANNEL}-score` }, "teacher", 50,
      setRecords, () => undefined, () => undefined);
    return () => board.close();
  }, [roomId, session.roundId]);

  if (prepared.loading || participants.loading) return <StatusPanel title="단어 데스매치 준비 중">단어 세트와 참가자를 불러오고 있습니다.</StatusPanel>;
  if (prepared.error || participants.error) return <StatusPanel title="단어 데스매치 오류" tone="error">{prepared.error?.message ?? participants.error?.message}</StatusPanel>;
  if (!prepared.quiz) return <StatusPanel title="학습 세트 오류" tone="error">단어 세트를 선택해 주세요.</StatusPanel>;

  const scores = new Map(records.map((record) => [record.playerId, record.score]));
  const ranking = participants.value.filter((participant) => session.expectedPlayerIds.includes(participant.playerId))
    .map((participant) => ({ id: participant.playerId, label: displayLabel(participant.displayName, participant.nickname), value: scores.get(participant.playerId) ?? 0 }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, "ko-KR"));
  const question = clock.round ? prepared.quiz.questionAt(clock.round.index) : null;

  return <div className={styles.teacherShell} ref={shellRef}>
    <main className={styles.teacherMain}>
      <header className={styles.teacherHeader}>
        <TimedGameStatus session={session} compact />
        <FullscreenToggle target={shellRef} />
      </header>
      {question && clock.round ? <WordQuestionHud question={question} round={clock.round} /> : null}
    </main>
    <aside className={styles.ranking}>
      <h3>현재 순위</h3>
      {ranking.map((entry, index) => <div key={entry.id} className={styles.rankRow}>
        <strong>{index + 1}</strong><span>{entry.label}</span><b>{entry.value}개</b>
      </div>)}
    </aside>
    {timed.expired ? <TimedResultsOverlay title="단어 데스매치 결과" unit="개" entries={ranking}
      note="게임을 끝내면 학생들이 대기실로 돌아갑니다." /> : null}
  </div>;
}
