import { useEffect, useState } from "react";
import { MAX_NOTICE_LENGTH } from "../../../classroom-notice/model.ts";
import { publishNotice } from "../../../classroom-notice/repository.ts";
import { useClassroomNotice } from "../../../classroom-notice/useClassroomNotice.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./NoticeEditor.module.css";

/**
 * The teacher's notice for the student lobby. The text stays in the editor after publishing,
 * so the next notice is an edit of the last one.
 */
export default function NoticeEditor({ roomId }: { readonly roomId: string }) {
  const { notice, loading, error: loadError } = useClassroomNotice(roomId);
  const published = notice?.text ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Until the teacher types, the editor follows what is published.
  const text = draft ?? published;
  useEffect(() => { if (draft === published) setDraft(null); }, [draft, published]);

  const publish = async (): Promise<void> => {
    setSaving(true);
    setError("");
    try {
      await publishNotice(roomId, text);
      setDraft(null);
    } catch (cause: unknown) {
      setError(toErrorMessage(cause, "공지를 게시하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  const unchanged = text.trim() === published.trim();
  return <Card className={styles.card}>
    <h2>공지</h2>
    <textarea className={styles.input} rows={4} maxLength={MAX_NOTICE_LENGTH} value={text} aria-label="공지 내용" disabled={loading || saving}
      onChange={(event) => setDraft(event.target.value)} />
    <div className={styles.actions}>
      <Button variant="accent" size="sm" onClick={() => void publish()} disabled={loading || saving || unchanged}>{saving ? "게시 중…" : unchanged ? "게시됨" : "게시하기"}</Button>
    </div>
    {error || loadError ? <p className={styles.error} role="alert">{error || loadError?.message}</p> : null}
  </Card>;
}
