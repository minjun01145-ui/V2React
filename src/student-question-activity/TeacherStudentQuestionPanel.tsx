import { useEffect, useMemo, useState } from "react";
import type { Player } from "../multiplayer/types.ts";
import Button from "../shared/ui/Button.tsx";
import Card from "../shared/ui/Card.tsx";
import { finalizeStudentQuestionActivity, startStudentQuestionActivity, subscribeStudentQuestionSubmissions } from "./repository.ts";
import type { StudentQuestionActivity, StudentQuestionSubmission } from "./types.ts";
import styles from "./TeacherStudentQuestionPanel.module.css";

export default function TeacherStudentQuestionPanel({ roomId, activePlayers, activity, disabled, onError }: {
  readonly roomId: string;
  readonly activePlayers: readonly Player[];
  readonly activity: StudentQuestionActivity | null;
  readonly disabled: boolean;
  readonly onError: (error: unknown) => void;
}) {
  const [questionCount, setQuestionCount] = useState(1);
  const [englishOnly, setEnglishOnly] = useState(false);
  const [submissions, setSubmissions] = useState<readonly StudentQuestionSubmission[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setSubmissions([]);
    if (!activity) return undefined;
    return subscribeStudentQuestionSubmissions(roomId, activity.runId, setSubmissions, onError);
  }, [activity, onError, roomId]);
  const submittedIds = useMemo(() => new Set(submissions.filter((item) => item.submitted).map((item) => item.playerId)), [submissions]);
  const expectedPlayers = activity ? activity.expectedPlayerIds.map((id) => activePlayers.find((player) => player.id === id) ?? null) : [];
  const run = async (action: () => Promise<unknown>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error: unknown) { onError(error); } finally { setBusy(false); }
  };
  if (activity) return <Card className={styles.panel}>
    <div className={styles.heading}><div><span>STUDENT QUESTIONS</span><h2>질문 만들기 진행 중</h2></div><strong>{submittedIds.size} / {activity.expectedPlayerIds.length}명</strong></div>
    <div className={styles.students}>{expectedPlayers.map((player, index) => {
      const id = activity.expectedPlayerIds[index] ?? "";
      return <div key={id}><span>{player ? (player.nickname || player.displayName) : id}</span><strong>{submittedIds.has(id) ? "제출 완료" : "작성 중"}</strong></div>;
    })}</div>
    <Button variant="ghost" disabled={disabled || busy || activity.phase !== "active"} onClick={() => void run(() => finalizeStudentQuestionActivity(roomId, activity.runId))}>{busy ? "종료 중…" : "질문 만들기 종료"}</Button>
  </Card>;
  return <Card className={styles.panel}>
    <div><span className={styles.eyebrow}>STUDENT QUESTIONS</span><h2>학생 질문 만들기</h2><p>현재 접속 학생을 고정 명단으로 시작합니다.</p></div>
    <div className={styles.controls}>
      <label>학생당 질문 수<select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} disabled={disabled || busy}>{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}개</option>)}</select></label>
      <label className={styles.checkbox}><input type="checkbox" checked={englishOnly} onChange={(event) => setEnglishOnly(event.target.checked)} disabled={disabled || busy} />영어 질문만 받기</label>
      <Button disabled={disabled || busy || activePlayers.length === 0} onClick={() => void run(() => startStudentQuestionActivity(roomId, { questionCount, englishQuestionsOnly: englishOnly }, activePlayers.map((player) => player.id)))}>{busy ? "시작 중…" : "질문 만들기 시작"}</Button>
    </div>
  </Card>;
}
