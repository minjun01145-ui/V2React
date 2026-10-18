import { useEffect, useState } from "react";
import { getLearningSet } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE } from "../../../learning-sets/types.ts";
import { generateExamQuestions } from "../../../question-bank/generator.ts";
import { deleteBankQuestion, listBankQuestions, saveBankQuestions } from "../../../question-bank/repository.ts";
import type { BankQuestion, ExamQuestionContent } from "../../../question-bank/types.ts";
import QuestionPreview from "../../../question-bank/ui/QuestionPreview.tsx";
import { aiUsageLabel, type AiUsage } from "../../../shared/aiUsage.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./ExamQuestionBuilder.module.css";

const BATCH_SIZE = 5;

/** Builds a set's question bank five AI questions at a time; the teacher keeps the good ones. */
export default function ExamQuestionBuilder({ setId, onBuildWorksheet }: {
  readonly setId: string;
  readonly onBuildWorksheet: (questions: readonly BankQuestion[]) => void;
}) {
  const [saved, setSaved] = useState<readonly BankQuestion[]>([]);
  const [drafts, setDrafts] = useState<readonly ExamQuestionContent[]>([]);
  const [chosen, setChosen] = useState<ReadonlySet<number>>(new Set());
  const [usage, setUsage] = useState<AiUsage | null>(null);
  const [busy, setBusy] = useState<"" | "load" | "generate" | "save" | "delete">("load");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setSaved([]); setDrafts([]); setChosen(new Set()); setUsage(null); setError(""); setBusy("load");
    void listBankQuestions(setId).then((questions) => { if (active) setSaved(questions); })
      .catch((value: unknown) => { if (active) setError(toErrorMessage(value, "저장된 문제를 불러오지 못했습니다.")); })
      .finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, [setId]);

  const run = async (kind: typeof busy, task: () => Promise<void>, failure: string): Promise<void> => {
    setBusy(kind); setError("");
    try { await task(); } catch (value: unknown) { setError(toErrorMessage(value, failure)); } finally { setBusy(""); }
  };

  const generate = () => run("generate", async () => {
    const set = await getLearningSet(setId, "worksheets", { allowMissingReadingMeanings: true });
    if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS || !set.items.length) throw new Error("본문이 있는 끊어읽기 세트를 선택해주세요.");
    const result = await generateExamQuestions(set, BATCH_SIZE, [...saved.map((question) => question.content), ...drafts]);
    setDrafts(result.questions); setChosen(new Set()); setUsage(result.usage);
  }, "문제를 만들지 못했습니다.");

  const saveChosen = () => run("save", async () => {
    await saveBankQuestions(setId, drafts.filter((_, index) => chosen.has(index)));
    setSaved(await listBankQuestions(setId));
    setDrafts((current) => current.filter((_, index) => !chosen.has(index)));
    setChosen(new Set());
  }, "문제를 저장하지 못했습니다.");

  const remove = (question: BankQuestion) => run("delete", async () => {
    await deleteBankQuestion(question.id);
    setSaved((current) => current.filter((entry) => entry.id !== question.id));
  }, "문제를 삭제하지 못했습니다.");

  const toggle = (index: number): void => setChosen((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  return <Card as="div" className={styles.builder}>
    <div className={styles.toolbar}>
      <strong>저장된 문제 {saved.length}개</strong>
      <Button onClick={() => void generate()} disabled={Boolean(busy)}>{busy === "generate" ? "만드는 중…" : `${BATCH_SIZE}문제 만들기`}</Button>
      <Button variant="accent" onClick={() => onBuildWorksheet(saved)} disabled={Boolean(busy) || !saved.length}>학습지 생성하기</Button>
      {usage ? <span className={styles.usage} role="status">{aiUsageLabel(usage)}</span> : null}
    </div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {busy === "generate" ? <p role="status">AI2가 시험 문제를 만드는 중…</p> : null}
    {drafts.length ? <section className={styles.drafts} aria-label="새로 만든 문제">
      {drafts.map((draft, index) => <label key={index} className={styles.draft} data-chosen={chosen.has(index)}>
        <input type="checkbox" checked={chosen.has(index)} onChange={() => toggle(index)} disabled={Boolean(busy)} />
        <QuestionPreview content={draft} />
      </label>)}
      <div className={styles.toolbar}>
        <Button variant="ghost" onClick={() => setChosen(new Set(drafts.map((_, index) => index)))} disabled={Boolean(busy)}>모두 선택</Button>
        <Button onClick={() => void saveChosen()} disabled={Boolean(busy) || !chosen.size}>{busy === "save" ? "저장 중…" : `선택한 ${chosen.size}문제 저장`}</Button>
      </div>
    </section> : null}
    {saved.length ? <details className={styles.saved}>
      <summary>저장된 문제 보기</summary>
      <ol>{saved.map((question) => <li key={question.id}>
        <QuestionPreview content={question.content} />
        <Button variant="ghost" size="sm" onClick={() => void remove(question)} disabled={Boolean(busy)}>삭제</Button>
      </li>)}</ol>
    </details> : null}
  </Card>;
}
