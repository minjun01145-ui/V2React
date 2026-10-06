import { useState } from "react";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { FREE_RESPONSE_AWARD_POINTS, type FreeResponseRow } from "../types.ts";
import styles from "./FreeResponse.module.css";
import FreeResponseSpotlight from "./FreeResponseSpotlight.tsx";

// 데이터 구독과 채점 처리는 외부에서 주입하여 다른 발표 화면에서도 재사용한다.
// 화면에 띄우는 용도라 학번·이름은 표시하지 않고, 닉네임도 숨길 수 있다.
export default function FreeResponseDashboard({ rows, onAward, busyPlayerId = null, disabled = false }: {
  readonly rows: readonly FreeResponseRow[];
  readonly onAward: (playerId: string) => void;
  readonly busyPlayerId?: string | null;
  readonly disabled?: boolean;
}) {
  const submittedCount = rows.filter((row) => row.response).length;
  const [spotlight, setSpotlight] = useState(false);
  const [showNicknames, setShowNicknames] = useState(true);
  const nicknameToggle = <Button size="sm" variant="ghost" onClick={() => setShowNicknames((value) => !value)}>{showNicknames ? "닉네임 숨기기" : "닉네임 보이기"}</Button>;
  return <Card className={styles.dashboard}>
    <header><h2>자유 답안 현황</h2><span>제출 {submittedCount}/{rows.length}명</span>{nicknameToggle}<Button size="sm" onClick={() => setSpotlight(true)} disabled={submittedCount === 0}>크게 보기</Button></header>
    {spotlight ? <FreeResponseSpotlight rows={rows} showNicknames={showNicknames} nicknameToggle={nicknameToggle} onAward={onAward} busyPlayerId={busyPlayerId} disabled={disabled} onClose={() => setSpotlight(false)} /> : null}
    {rows.length === 0 ? <p>참가한 학생이 없습니다.</p> : <div className={styles.grid}>{rows.map((row, index) => {
      const awarded = row.response?.score === FREE_RESPONSE_AWARD_POINTS;
      return <button type="button" className={styles.response} data-awarded={awarded} key={row.playerId}
        disabled={disabled || busyPlayerId !== null || !row.response || awarded}
        aria-label={`${index + 1}번 답안${awarded ? ": 100점 부여 완료" : row.response ? ": 100점 부여" : ": 미제출"}`}
        onClick={() => onAward(row.playerId)}>
        {showNicknames && row.nickname ? <strong className={styles.identity}>{row.nickname}</strong> : null}
        <span className={styles.answer}>{row.response?.answer ?? "미제출"}</span>
        <b>{busyPlayerId === row.playerId ? "점수 저장 중…" : awarded ? "100점 부여 완료" : row.response ? "+100점 부여" : "답안 없음"}</b>
      </button>;
    })}</div>}
  </Card>;
}
