import { useEffect, useMemo, useRef, useState } from "react";
import type { TeacherGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useDeadlineCountdown } from "../../game-engine/timed-turn/useDeadlineCountdown.ts";
import { useWordUnoAssignments } from "../../multiplayer/word-uno/hooks.ts";
import { expireWordUnoRound } from "../../multiplayer/word-uno/repository.ts";
import type { WordUnoAssignment } from "../../multiplayer/word-uno/types.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./WordUno.module.css";

const ROUND_DURATION_MS = 3 * 60_000;

function SharedClock({ endsAtMs }: { readonly endsAtMs: number | null }) {
  const countdown = useDeadlineCountdown(endsAtMs, ROUND_DURATION_MS);
  const seconds = Math.ceil((countdown?.remainingMs ?? 0) / 1_000);
  const minutes = Math.floor(seconds / 60);
  return <div className={styles.roundClock} role="timer"><span>게임 시간</span><strong>{endsAtMs === null ? "--:--" : `${minutes}:${String(seconds % 60).padStart(2, "0")}`}</strong></div>;
}

function nickname(assignment: WordUnoAssignment): string {
  return assignment.members.find((member) => member.playerId === assignment.playerId)?.nickname ?? assignment.playerId;
}

export default function WordUnoTeacherGame({ roomId, session }: TeacherGameModuleProps) {
  const assignments = useWordUnoAssignments(roomId, session.roundId);
  const endsAtMs = assignments.value.find((item) => item.endsAtMs !== null)?.endsAtMs ?? null;
  const roundCountdown = useDeadlineCountdown(endsAtMs, ROUND_DURATION_MS);
  const expiryKey = useRef("");
  const [expiryRetry, setExpiryRetry] = useState(0);
  const groups = useMemo(() => {
    const byGroup = new Map<string, WordUnoAssignment[]>();
    for (const item of assignments.value) {
      const key = item.groupId ?? "waiting";
      byGroup.set(key, [...(byGroup.get(key) ?? []), item]);
    }
    return [...byGroup.entries()].sort(([, left], [, right]) => (left[0]?.groupLabel ?? "대기").localeCompare(right[0]?.groupLabel ?? "대기", "ko-KR"));
  }, [assignments.value]);
  const hasUnfinishedGroup = assignments.value.some((item) => item.groupId !== null && item.status !== "completed");

  useEffect(() => {
    if (!endsAtMs || !roundCountdown?.expired || !hasUnfinishedGroup) return;
    const key = String(endsAtMs);
    if (expiryKey.current === key) return;
    expiryKey.current = key;
    const retry = (): void => {
      window.setTimeout(() => {
        expiryKey.current = "";
        setExpiryRetry((value) => value + 1);
      }, 1_000);
    };
    void expireWordUnoRound(roomId, session.roundId).then((accepted) => { if (!accepted) retry(); }).catch(retry);
  }, [endsAtMs, expiryRetry, hasUnfinishedGroup, roomId, roundCountdown?.expired, session.roundId]);

  if (assignments.error) return <StatusPanel title="Word UNO 현황 연결 오류" tone="error">{assignments.error.message}</StatusPanel>;
  if (assignments.loading) return <StatusPanel title="Word UNO 준비 중" tone="waiting">학생들을 조에 배치하고 카드를 나누고 있습니다.</StatusPanel>;

  return <div className={styles.teacherShell}>
    <div className={styles.teacherHeader}><div><h2>Word UNO 현황</h2><p>{assignments.value.length}명 참여</p></div><SharedClock endsAtMs={endsAtMs} /></div>
    {groups.length === 0 ? <StatusPanel title="참가 학생을 기다리는 중" tone="waiting">학생이 연결되면 조 현황이 여기에 표시됩니다.</StatusPanel> : null}
    <div className={styles.groupGrid}>{groups.map(([groupId, members]) => {
      const first = members[0];
      const currentPlayerId = first?.currentPlayerId ?? null;
      return <Card className={styles.groupCard} key={groupId}>
        <header><div><span>{first?.groupLabel ?? "대기"}</span><strong>{members.length}명</strong></div><em>{first?.activeStage ? `${first.activeStage}단계` : "단계 선택 전"}</em></header>
        <div className={styles.teacherRows}>{members
          .slice()
          .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || nickname(a).localeCompare(nickname(b), "ko-KR"))
          .map((member) => <div key={member.playerId} data-current={member.playerId === currentPlayerId}>
            <strong>{nickname(member)}</strong>
            <span>{member.hand.length}장</span>
            <span>{member.rank ? `${member.rank}등` : member.status === "waiting" ? "대기" : member.playerId === currentPlayerId ? "현재 차례" : "진행 중"}</span>
          </div>)}</div>
      </Card>;
    })}</div>
  </div>;
}
