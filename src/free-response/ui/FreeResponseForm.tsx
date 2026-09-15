import { useEffect, useRef, useState, type FormEvent } from "react";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { validateFreeResponseAnswer } from "../model.ts";
import { FREE_RESPONSE_MAX_LENGTH } from "../types.ts";
import styles from "./FreeResponse.module.css";

export default function FreeResponseForm({ prompt, submittedAnswer, closed = false, onSubmit }: {
  readonly prompt: string;
  readonly submittedAnswer: string | null;
  readonly closed?: boolean;
  readonly onSubmit: (answer: string) => Promise<void>;
}) {
  const [answer, setAnswer] = useState(submittedAnswer ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  useEffect(() => { setAnswer(submittedAnswer ?? ""); }, [submittedAnswer]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (closed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await onSubmit(validateFreeResponseAnswer(answer));
      setNotice("답안을 제출했어요. 마감 전까지 수정할 수 있어요.");
    } catch (value: unknown) {
      setError(toErrorMessage(value, "답안을 제출하지 못했습니다."));
    } finally { busyRef.current = false; setBusy(false); }
  };
  return <Card as="form" className={styles.form} onSubmit={(event) => void submit(event)}>
    <h2 className={styles.prompt}>{prompt}</h2>
    <p>정해진 정답 없이 자유롭게 생각을 적어 주세요.</p>
    <label>내 답안<textarea rows={6} value={answer} maxLength={FREE_RESPONSE_MAX_LENGTH} onChange={(event) => setAnswer(event.target.value)} disabled={closed || busy} placeholder="답안을 입력하세요" /></label>
    <small>{answer.length}/{FREE_RESPONSE_MAX_LENGTH}자</small>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {closed ? <p role="status">{submittedAnswer ? "답안 제출이 마감되었어요. 제출한 답안을 선생님이 확인합니다." : "답안 제출이 마감되었어요."}</p> : notice ? <p role="status">{notice}</p> : submittedAnswer ? <p role="status">제출된 답안이 있어요. 마감 전까지 수정할 수 있어요.</p> : null}
    <Button type="submit" disabled={closed || busy || !answer.trim() || answer.trim() === submittedAnswer}>{closed ? "답안 제출 마감" : busy ? "제출 중…" : submittedAnswer ? "답안 수정 제출" : "답안 제출"}</Button>
  </Card>;
}
