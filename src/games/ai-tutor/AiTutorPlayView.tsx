import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { AiTutorEvaluationDetails, AiTutorQuestion, AiTutorReply } from "../../ai-tutor-engine/types.ts";
import type { GameProgress } from "../../game-engine/progress/index.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import styles from "./AiTutor.module.css";

export interface AiTutorPlayModel {
  readonly title: string;
  readonly currentQuestion: AiTutorQuestion | null;
  readonly progress: GameProgress<AiTutorEvaluationDetails>;
  readonly totalCount: number;
  readonly reply: AiTutorReply | null;
  readonly busy: boolean;
  readonly loading: boolean;
  readonly error: Error | null;
  readonly submit: (message: string) => Promise<void>;
  readonly goNext: () => Promise<void>;
}

export default function AiTutorPlayView({ game, clockExpired = false, remainingMs = null, onFinish, onExit }: {
  readonly game: AiTutorPlayModel;
  readonly clockExpired?: boolean;
  readonly remainingMs?: number | null;
  readonly onFinish?: () => Promise<void>;
  readonly onExit?: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [finishError, setFinishError] = useState("");
  const automaticFinishStartedRef = useRef(false);
  const answerRef = useRef<HTMLTextAreaElement>(null);
  const answered = Boolean(game.progress.lastResult?.isCorrect);

  useEffect(() => {
    if (!game.busy && !answered && game.currentQuestion && !clockExpired) answerRef.current?.focus();
  }, [answered, clockExpired, game.busy, game.currentQuestion?.id]);

  useEffect(() => {
    if (!answered || game.busy) return;
    const onNextKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
      event.preventDefault();
      void game.goNext();
    };
    document.addEventListener("keydown", onNextKeyDown);
    return () => document.removeEventListener("keydown", onNextKeyDown);
  }, [answered, game.busy, game.goNext]);

  useEffect(() => {
    if (!onFinish || finishing || exiting || game.busy || game.loading
      || automaticFinishStartedRef.current || (!clockExpired && game.progress.currentIndex < game.totalCount)) return;
    automaticFinishStartedRef.current = true;
    setFinishing(true);
    void onFinish().catch((error: unknown) => {
      console.error(error);
      setFinishError(error instanceof Error ? error.message : "결과를 저장하지 못했습니다.");
      setFinishing(false);
    });
  }, [clockExpired, exiting, finishing, game.busy, game.loading, game.progress.currentIndex, game.totalCount, onFinish]);

  const finish = async (): Promise<void> => {
    if (!onFinish || finishing || exiting || game.busy) return;
    setFinishing(true);
    setFinishError("");
    try { await onFinish(); }
    catch (error: unknown) {
      console.error(error);
      setFinishError(error instanceof Error ? error.message : "결과를 저장하지 못했습니다.");
      setFinishing(false);
    }
  };
  const exit = async (): Promise<void> => {
    if (!onExit || exiting || finishing || game.busy) return;
    setExiting(true);
    try { await onExit(); }
    catch (error: unknown) { console.error(error); setExiting(false); }
  };
  const isDisabled = clockExpired || finishing || exiting;

  if (game.loading) return <StatusPanel title="AI 문답 준비 중">진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (game.error && !game.currentQuestion) return <StatusPanel title="AI 문답 연결 오류" tone="error">{game.error.message}</StatusPanel>;
  if (!game.currentQuestion) return <StatusPanel title="학습 완료">
    모든 문제를 마쳤습니다. 총 {game.progress.score}점을 얻었어요!
    {finishError ? <p role="alert">{finishError}</p> : null}
    {finishError && onFinish ? <Button onClick={() => void finish()} disabled={finishing}>{finishing ? "결과 저장 중…" : "결과 저장 다시 시도"}</Button> : null}
  </StatusPanel>;

  const onSubmit = (event: FormEvent): void => {
    event.preventDefault();
    const submitted = message;
    if (!submitted.trim() || clockExpired || finishing || exiting) return;
    setMessage("");
    void game.submit(submitted);
  };
  const onAnswerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };
  return <main className={styles.game}>
    <header className={styles.topbar}>
      <div><h1>{game.title}</h1></div>
      <div className={styles.metrics}>
        <span>{game.progress.currentIndex + 1} / {game.totalCount}</span>
        {remainingMs !== null ? <span>남은 시간 {formatClock(remainingMs)}</span> : null}
        <strong>{game.progress.score}점</strong>
        {onExit ? <Button variant="ghost" onClick={() => void exit()} disabled={finishing || exiting || game.busy}>{exiting ? "종료 중…" : "그만하기"}</Button> : null}
        {onFinish ? <Button variant="ghost" onClick={() => void finish()} disabled={finishing || exiting || game.busy}>{finishing ? "결과 저장 중…" : "게임 마치기"}</Button> : null}
      </div>
    </header>

    <Card className={styles.questionCard}>
      <p className={styles.eyebrow}>{game.currentQuestion.promptLabel}</p>
      {game.currentQuestion.author
        ? <p className={styles.author}>{game.currentQuestion.author.nickname || game.currentQuestion.author.displayName} 학생이 낸 질문입니다</p>
        : null}
      <h2>{game.currentQuestion.prompt}</h2>
      <p className={styles.guide}>답을 입력하거나, 이 문제에 나온 모르는 단어·문법을 질문해도 됩니다.</p>
    </Card>

    <form className={styles.answerForm} onSubmit={onSubmit}>
      <label htmlFor="ai-tutor-answer">{game.currentQuestion.answerLabel}</label>
      <textarea
        ref={answerRef}
        id="ai-tutor-answer"
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={onAnswerKeyDown}
        disabled={game.busy || answered || isDisabled}
        maxLength={1000}
        placeholder="답 또는 문제와 관련된 질문을 입력하세요"
        autoFocus
      />
      <Button type="submit" disabled={game.busy || answered || isDisabled || !message.trim()}>
        {game.busy ? "AI가 살펴보는 중…" : "답변 보내기"}
      </Button>
    </form>

    {game.reply
      ? <section className={styles.feedback} data-kind={game.reply.kind} role="status">
          <strong>{game.reply.kind === "correct" ? "정답이에요!" : game.reply.kind === "retry" ? "조금만 더 생각해 볼까요?" : game.reply.kind === "help" ? "문제 도움말" : "문제와 관련된 내용만"}</strong>
          <p>{game.reply.feedback}</p>
          {game.reply.focus ? <p><b>확인할 부분:</b> {game.reply.focus}</p> : null}
          {game.reply.hint ? <p><b>힌트:</b> {game.reply.hint}</p> : null}
          {game.reply.isCorrect ? <Button onClick={() => void game.goNext()} disabled={game.busy || isDisabled}>다음 문제 (Enter)</Button> : null}
        </section>
      : answered
        ? <section className={styles.feedback} data-kind="correct" role="status">
            <strong>정답으로 인정된 문제예요.</strong>
            <p>다음 문제로 계속 진행하세요.</p>
            <Button onClick={() => void game.goNext()} disabled={game.busy || isDisabled}>다음 문제 (Enter)</Button>
          </section>
        : null}

    {game.error ? <p className={styles.error} role="alert">{game.error.message}</p> : null}
    {finishError ? <p className={styles.error} role="alert">{finishError}</p> : null}
  </main>;
}
