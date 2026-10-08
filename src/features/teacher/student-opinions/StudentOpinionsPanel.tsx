import { useState } from "react";
import { deleteOpinion } from "../../../student-opinions/repository.ts";
import { useStudentOpinions } from "../../../student-opinions/useStudentOpinions.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./StudentOpinionsPanel.module.css";

const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

/** Opinions students left from the lobby, newest first, without who wrote them. */
export default function StudentOpinionsPanel({ roomId }: { readonly roomId: string }) {
  const { opinions, loading, error } = useStudentOpinions(roomId);
  const { requestConfirmation, showMessage } = usePopup();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remove = async (id: string): Promise<void> => {
    const confirmed = await requestConfirmation({ title: "이 의견을 삭제할까요?", tone: "warning", confirmLabel: "삭제", blurBackground: false });
    if (!confirmed) return;
    setDeletingId(id);
    try {
      await deleteOpinion(roomId, id);
    } catch (cause: unknown) {
      await showMessage({ title: "의견을 삭제하지 못했어요", message: toErrorMessage(cause, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
    } finally {
      setDeletingId(null);
    }
  };

  return <Card className={styles.card}>
    <div className={styles.heading}><h2>학생 의견</h2><strong className={styles.count}>{opinions.length}</strong></div>
    {error ? <p className={styles.error} role="alert">{error.message}</p>
      : loading ? <p className={styles.empty}>의견을 불러오는 중…</p>
      : opinions.length === 0 ? <p className={styles.empty}>아직 남긴 의견이 없어요</p>
      : <ol className={styles.list}>{opinions.map((opinion) => <li key={opinion.id}>
        <p>{opinion.text}</p>
        <div className={styles.meta}>
          <time dateTime={new Date(opinion.createdAtMs).toISOString()}>{dateFormat.format(opinion.createdAtMs)}</time>
          <Button variant="quiet" size="sm" onClick={() => void remove(opinion.id)} disabled={deletingId !== null}>{deletingId === opinion.id ? "삭제 중…" : "삭제"}</Button>
        </div>
      </li>)}</ol>}
  </Card>;
}
