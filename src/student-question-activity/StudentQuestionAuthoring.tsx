import { useState, type FormEvent } from "react";
import Button from "../shared/ui/Button.tsx";
import Card from "../shared/ui/Card.tsx";
import StatusPanel from "../shared/StatusPanel.tsx";
import { requestStudentQuestionHelp, submitStudentQuestions } from "./repository.ts";
import type { StudentQuestionActivity, StudentQuestionDraft } from "./types.ts";
import { validateStudentQuestions } from "./validation.ts";
import styles from "./StudentQuestionAuthoring.module.css";

export default function StudentQuestionAuthoring({ roomId, playerId, activity }: { readonly roomId: string; readonly playerId: string; readonly activity: StudentQuestionActivity }) {
  const [questions, setQuestions] = useState<readonly StudentQuestionDraft[]>(() => Array.from({ length: activity.config.questionCount }, () => ({ question: "", referenceAnswer: "" })));
  const [helpPrompt, setHelpPrompt] = useState("");
  const [hint, setHint] = useState("");
  const [interactionCount, setInteractionCount] = useState(0);
  const [helpLevel, setHelpLevel] = useState(1);
  const [busy, setBusy] = useState<"submit" | "help" | "">("");
  const [error, setError] = useState("");

  const change = (index: number, key: keyof StudentQuestionDraft, value: string): void => {
    setQuestions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  };
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setError("");
    try {
      validateStudentQuestions(questions, activity.config);
      setBusy("submit");
      await submitStudentQuestions(roomId, activity.runId, playerId, activity.config, questions);
    } catch (value: unknown) { setError(value instanceof Error ? value.message : "질문을 제출하지 못했습니다."); }
    finally { setBusy(""); }
  };
  const getHelp = async (): Promise<void> => {
    if (busy || !helpPrompt.trim()) return;
    setBusy("help"); setError("");
    try {
      const nextCount = interactionCount + 1;
      const reply = await requestStudentQuestionHelp({ roomId, runId: activity.runId, message: helpPrompt.trim(), interactionCount: nextCount, helpLevel });
      setInteractionCount(nextCount); setHelpLevel(reply.helpLevel); setHint(reply.hint);
    } catch (value: unknown) { setError(value instanceof Error ? value.message : "AI 도움을 받지 못했습니다."); }
    finally { setBusy(""); }
  };
  return <main className={styles.stack}>
    <StatusPanel title="학생 질문 만들기" tone="waiting">질문과 모범답안을 직접 작성한 뒤 한 번에 제출하세요.</StatusPanel>
    <Card as="form" className={styles.form} onSubmit={(event) => void submit(event)}>
      {questions.map((item, index) => <fieldset key={index} className={styles.question} disabled={Boolean(busy)}>
        <legend>질문 {index + 1}</legend>
        <label>질문<textarea rows={3} maxLength={500} value={item.question} onChange={(event) => change(index, "question", event.target.value)} placeholder={activity.config.englishQuestionsOnly ? "영어 질문을 작성하세요" : "질문을 작성하세요"} /></label>
        <label>모범답안<textarea rows={3} maxLength={1000} value={item.referenceAnswer} onChange={(event) => change(index, "referenceAnswer", event.target.value)} placeholder="표현이 달라도 정답으로 인정할 기준 답안" /></label>
      </fieldset>)}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <Button type="submit" disabled={Boolean(busy)}>{busy === "submit" ? "제출 중…" : "질문 제출"}</Button>
    </Card>
    <Card className={styles.help}>
      <h2>질문을 만드는 데 막혔나요?</h2>
      <textarea rows={3} maxLength={700} value={helpPrompt} onChange={(event) => setHelpPrompt(event.target.value)} placeholder="예: 과거형 질문 어순이 헷갈려요" disabled={Boolean(busy)} />
      <Button variant="ghost" onClick={() => void getHelp()} disabled={Boolean(busy) || !helpPrompt.trim()}>{busy === "help" ? "힌트 생각 중…" : "AI 도와주세요"}</Button>
      {hint ? <p className={styles.hint} role="status">{hint}</p> : null}
    </Card>
  </main>;
}
