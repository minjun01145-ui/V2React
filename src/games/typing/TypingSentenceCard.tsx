import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import type { TypingComparisonState } from "./typingEngine.ts";
import type { TypingComparisonOptions, TypingQuestion } from "./types.ts";
import styles from "./SentencePracticeGame.module.css";

interface Props {
  readonly title: string;
  readonly question: TypingQuestion;
  readonly index: number;
  readonly upcomingQuestions: readonly TypingQuestion[];
  readonly input: string;
  readonly comparison: TypingComparisonState;
  readonly options: TypingComparisonOptions;
  readonly inputDisabled?: boolean;
  readonly nextDisabled: boolean;
  readonly nextLabel: string;
  readonly feedback?: ReactNode;
  readonly onInput: (value: string) => void;
  readonly onNext: () => void | Promise<unknown>;
}

export default function TypingSentenceCard({
  title, question, index, upcomingQuestions, input, comparison, options,
  inputDisabled = false, nextDisabled, nextLabel, feedback, onInput, onNext,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const advancingRef = useRef(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState("");

  useEffect(() => {
    if (!inputDisabled && !advancing) inputRef.current?.focus();
  }, [question.id, inputDisabled, advancing]);

  const advance = useCallback(async () => {
    if (nextDisabled || advancingRef.current) return;
    advancingRef.current = true;
    setAdvancing(true);
    setAdvanceError("");
    try {
      await onNext();
    } catch {
      setAdvanceError("다음 문장으로 넘어가지 못했어요. 다시 시도해주세요.");
    } finally {
      advancingRef.current = false;
      setAdvancing(false);
    }
  }, [nextDisabled, onNext]);

  useEffect(() => {
    if (nextDisabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.repeat || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("button")) return;
      event.preventDefault();
      void advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, nextDisabled]);

  return <Card className={styles.typingCard}>
    <div className={styles.cardHeader}><span>{title}</span><p>{question.helperText}</p></div>
    <p className={styles.target} aria-label={`입력할 문장: ${question.targetText}`}>
      <span>{question.targetText.slice(0, comparison.currentPrefixLength)}</span>
      <b data-error={comparison.hasError}>{question.targetText.slice(comparison.currentPrefixLength)}</b>
    </p>
    <label className={styles.inputLabel}><span>문장 입력 · Enter</span>
      <input ref={inputRef} autoFocus value={input} onChange={(event) => onInput(event.target.value)}
        disabled={inputDisabled || advancing} aria-invalid={comparison.hasError}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
    </label>
    <div className={styles.feedback} data-tone={advanceError || comparison.hasError ? "error" : "neutral"} role="status">
      {advanceError || feedback || (comparison.hasError ? "오타를 고쳐주세요." : null)}
      <Button disabled={nextDisabled || advancing} onClick={() => void advance()}>
        {advancing ? "다음 문장 저장 중…" : advanceError ? "다시 다음 문장" : nextLabel}
      </Button>
    </div>
    <p>{options.ignoreCase ? "대소문자 구분 없음" : "대소문자 구분"} · {options.ignorePunctuation ? "특수문자 생략 가능" : "특수문자 포함"}</p>
    <ol className={styles.upcoming} start={index + 2} aria-label="다음에 입력할 문장">
      {upcomingQuestions.map((nextQuestion) => <li key={nextQuestion.id} value={nextQuestion.source.itemIndex + 1}>{nextQuestion.targetText}</li>)}
    </ol>
  </Card>;
}
