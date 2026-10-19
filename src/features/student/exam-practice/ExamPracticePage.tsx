import { useEffect, useState } from "react";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, type LearningSetSummary } from "../../../learning-sets/types.ts";
import { isAnswered, isCorrectResponse, type PracticeResponse } from "../../../question-bank/grading.ts";
import { PRACTICE_BATCH_SIZE, requestPracticeQuestions } from "../../../question-bank/studentPractice.ts";
import type { ExamQuestionContent } from "../../../question-bank/types.ts";
import { resolveStudentGameDataAccountId } from "../../../student-data/accountId.ts";
import { deleteWrongAnswer, saveWrongAnswer } from "../../../student-data/exam-practice/repository.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import Field from "../../../shared/ui/Field.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import Select from "../../../shared/ui/Select.tsx";
import PracticeQuestionCard from "./PracticeQuestionCard.tsx";
import WrongAnswerNotebook from "./WrongAnswerNotebook.tsx";
import styles from "./ExamPractice.module.css";

type Tab = "solve" | "notebook";
const TABS = [{ id: "solve", label: "문제 풀기" }, { id: "notebook", label: "오답노트" }] as const;

interface Graded {
  /** Per question: right or wrong, and the 오답노트 entry saved for a wrong one. */
  readonly results: readonly ("correct" | "wrong")[];
  readonly savedIds: readonly (string | null)[];
}

/**
 * Exam practice in the student lobby: AI questions on a reading set, five at a time. The student
 * answers, grades, then sees answers and explanations; wrong ones go to the 오답노트 automatically.
 */
export default function ExamPracticePage({ uid, studentNumber, onExit }: { readonly uid: string; readonly studentNumber: string; readonly onExit: () => void }) {
  const [tab, setTab] = useState<Tab>("solve");
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [setId, setSetId] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<readonly ExamQuestionContent[]>([]);
  const [history, setHistory] = useState<readonly ExamQuestionContent[]>([]);
  const [responses, setResponses] = useState<ReadonlyMap<number, PracticeResponse>>(new Map());
  const [graded, setGraded] = useState<Graded | null>(null);
  const [busy, setBusy] = useState<"" | "generate" | "grade">("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([listLearningSets(), resolveStudentGameDataAccountId(uid, studentNumber)])
      .then(([loaded, account]) => {
        if (!active) return;
        const readingSets = loaded.filter((set) => set.type === LEARNING_SET_TYPE.READING_CHUNKS && set.itemCount > 0);
        setSets(readingSets);
        setSetId((current) => current || readingSets[0]?.id || "");
        setAccountId(account);
      })
      .catch((cause: unknown) => { if (active) setError(toErrorMessage(cause, "학습 세트를 불러오지 못했어요.")); });
    return () => { active = false; };
  }, [uid, studentNumber]);

  const generate = async (): Promise<void> => {
    if (!setId || busy) return;
    setBusy("generate");
    setError("");
    try {
      const next = await requestPracticeQuestions(setId, history);
      setQuestions(next);
      setHistory((current) => [...current, ...next]);
      setResponses(new Map());
      setGraded(null);
    } catch (cause: unknown) {
      setError(toErrorMessage(cause, "문제를 만들지 못했어요. 잠시 후 다시 시도해 주세요."));
    } finally {
      setBusy("");
    }
  };

  const grade = async (): Promise<void> => {
    if (!accountId || busy) return;
    setBusy("grade");
    setError("");
    const results = questions.map((content, index) => isCorrectResponse(content, responses.get(index)!) ? "correct" as const : "wrong" as const);
    const setName = sets.find((set) => set.id === setId)?.name ?? "";
    try {
      const savedIds = await Promise.all(questions.map((content, index) => results[index] === "wrong"
        ? saveWrongAnswer(accountId, { setId, setName, content, response: responses.get(index)! })
        : Promise.resolve(null)));
      setGraded({ results, savedIds });
    } catch (cause: unknown) {
      setGraded({ results, savedIds: questions.map(() => null) });
      setError(toErrorMessage(cause, "틀린 문제를 오답노트에 저장하지 못했어요."));
    } finally {
      setBusy("");
    }
  };

  /** A written answer that only differs in wording: count it as right and take it out of the 오답노트. */
  const acceptWritten = (index: number): void => {
    if (!graded || !accountId) return;
    const savedId = graded.savedIds[index];
    setGraded({ results: graded.results.map((result, item) => item === index ? "correct" : result), savedIds: graded.savedIds.map((id, item) => item === index ? null : id) });
    if (savedId) void deleteWrongAnswer(accountId, savedId).catch((cause: unknown) => setError(toErrorMessage(cause, "오답노트에서 빼지 못했어요.")));
  };

  const remaining = questions.filter((_, index) => !isAnswered(responses.get(index))).length;
  const correctCount = graded?.results.filter((result) => result === "correct").length ?? 0;
  const generateLabel = busy === "generate" ? "AI가 문제를 만드는 중…" : questions.length ? `새 ${PRACTICE_BATCH_SIZE}문제 만들기` : `${PRACTICE_BATCH_SIZE}문제 만들기`;

  return <section className={styles.page} aria-label="시험문제 풀기">
    <Card className={styles.header}>
      <h2>시험문제 풀기</h2>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} ariaLabel="보기" size="sm" />
      <Button variant="ghost" onClick={onExit}>대기실로</Button>
    </Card>
    {tab === "notebook" ? <Card>{accountId ? <WrongAnswerNotebook accountId={accountId} /> : <p className={styles.empty}>불러오는 중…</p>}</Card> : <>
      <Card className={styles.setup}>
        <Field label="본문 세트">
          <Select value={setId} onChange={(event) => setSetId(event.target.value)} disabled={Boolean(busy) || sets.length === 0}>
            {sets.length === 0 ? <option value="">본문 세트가 없어요</option> : sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
          </Select>
        </Field>
        <Button variant="accent" onClick={() => void generate()} disabled={Boolean(busy) || !setId || (questions.length > 0 && !graded)}>{questions.length > 0 && !graded && busy !== "generate" ? "채점 후 새로 만들 수 있어요" : generateLabel}</Button>
      </Card>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {questions.length ? <div className={styles.questions}>
        {questions.map((content, index) => <PracticeQuestionCard key={`${history.length}-${index}`} number={index + 1} content={content}
          response={responses.get(index)} result={graded?.results[index] ?? null}
          onResponse={(response) => setResponses((current) => new Map(current).set(index, response))}
          onAcceptWritten={graded?.results[index] === "wrong" && content.format === "written" ? () => acceptWritten(index) : undefined} />)}
        {graded
          ? <p className={styles.score} role="status">{questions.length}문제 중 {correctCount}문제 맞았어요</p>
          : <Button variant="accent" size="lg" onClick={() => void grade()} disabled={Boolean(busy) || remaining > 0 || !accountId}>{busy === "grade" ? "채점 중…" : remaining > 0 ? `${remaining}문제 남았어요` : "채점하기"}</Button>}
      </div> : null}
    </>}
  </section>;
}
