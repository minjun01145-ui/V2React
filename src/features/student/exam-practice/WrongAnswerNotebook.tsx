import { useEffect, useState } from "react";
import { CHOICE_MARKS } from "../../../question-bank/types.ts";
import QuestionPreview from "../../../question-bank/ui/QuestionPreview.tsx";
import { deleteWrongAnswer, listWrongAnswers, type WrongAnswer } from "../../../student-data/exam-practice/repository.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import styles from "./ExamPractice.module.css";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" });

/** The student's 오답노트: every question they got wrong, with the answer they gave. */
export default function WrongAnswerNotebook({ accountId }: { readonly accountId: string }) {
  const [entries, setEntries] = useState<readonly WrongAnswer[] | null>(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listWrongAnswers(accountId)
      .then((loaded) => { if (active) setEntries(loaded); })
      .catch((cause: unknown) => { if (active) setError(toErrorMessage(cause, "오답노트를 불러오지 못했어요.")); });
    return () => { active = false; };
  }, [accountId]);

  const remove = async (entry: WrongAnswer): Promise<void> => {
    setDeletingId(entry.id);
    try {
      await deleteWrongAnswer(accountId, entry.id);
      setEntries((current) => current?.filter((item) => item.id !== entry.id) ?? null);
    } catch (cause: unknown) {
      setError(toErrorMessage(cause, "삭제하지 못했어요."));
    } finally {
      setDeletingId(null);
    }
  };

  if (error) return <StatusPanel title="오답노트 오류" tone="error">{error}</StatusPanel>;
  if (!entries) return <StatusPanel title="오답노트 불러오는 중" tone="waiting">잠시만 기다려 주세요.</StatusPanel>;
  if (entries.length === 0) return <p className={styles.empty}>아직 틀린 문제가 없어요</p>;
  return <ol className={styles.notebook}>{entries.map((entry) => <li key={entry.id} className={styles.noteItem}>
    <div className={styles.noteMeta}>
      <span>{entry.setName} · {dateFormat.format(entry.createdAtMs)}</span>
      <Button variant="quiet" size="sm" onClick={() => void remove(entry)} disabled={deletingId !== null}>{deletingId === entry.id ? "삭제 중…" : "삭제"}</Button>
    </div>
    <QuestionPreview content={entry.content} />
    <p className={styles.myAnswer}><b>내 답</b> {entry.response.format === "choice" ? CHOICE_MARKS[entry.response.choice - 1] ?? entry.response.choice : entry.response.text || "(빈칸)"}</p>
  </li>)}</ol>;
}
