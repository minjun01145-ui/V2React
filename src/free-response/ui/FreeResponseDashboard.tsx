import { useState } from "react";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { FREE_RESPONSE_AWARD_POINTS, type FreeResponseRow } from "../types.ts";
import styles from "./FreeResponse.module.css";
import FreeResponseSpotlight from "./FreeResponseSpotlight.tsx";

// 데이터 구독과 채점 처리는 외부에서 주입하여 다른 발표 화면에서도 재사용한다.
export default function FreeResponseDashboard({ rows, onAward, busyPlayerId = null, disabled = false }: {
  readonly rows: readonly FreeResponseRow[];
  readonly onAward: (playerId: string) => void;
  readonly busyPlayerId?: string | null;
  readonly disabled?: boolean;
}) {
  const submittedCount = rows.filter((row) => row.response).length;
  const [spotlight, setSpotlight] = useState(false);
  return <Card className={styles.dashboard}>
    <header><h2>자유 답안 현황</h2><span>제출 {submittedCount}/{rows.length}명</span><Button size="sm" onClick={() => setSpotlight(true)} disabled={submittedCount === 0}>크게 보기</Button></header>
    {spotlight ? <FreeResponseSpotlight rows={rows} onAward={onAward} busyPlayerId={busyPlayerId} disabled={disabled} onClose={() => setSpotlight(false)} /> : null}
    {rows.length === 0 ? <p>참가한 학생이 없습니다.</p> : <div className={styles.grid}>{rows.map((row) => {
      const awarded = row.response?.score === FREE_RESPONSE_AWARD_POINTS;
      return <button type="button" className={styles.response} data-awarded={awarded} key={row.playerId}
        disabled={disabled || busyPlayerId !== null || !row.response || awarded}
        aria-label={`${row.studentNumber} ${row.displayName}${awarded ? ": 100점 부여 완료" : row.response ? ": 100점 부여" : ": 미제출"}`}
        onClick={() => onAward(row.playerId)}>
        <span className={styles.identity}><strong>{row.nickname || row.displayName}</strong><small>{row.studentNumber} · {row.displayName}</small></span>
        <span className={styles.answer}>{row.response?.answer ?? "미제출"}</span>
        <b>{busyPlayerId === row.playerId ? "점수 저장 중…" : awarded ? "100점 부여 완료" : row.response ? "+100점 부여" : "답안 없음"}</b>
      </button>;
    })}</div>}
  </Card>;
}
