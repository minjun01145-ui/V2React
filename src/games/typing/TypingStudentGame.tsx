import type { ChangeEvent } from "react";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import Card from "../../shared/ui/Card.tsx";
import { useTypingGame } from "./useTypingGame.ts";
import { useTypingSet } from "./useTypingSet.ts";
import styles from "./Typing.module.css";

function TypingPlayArea({ roomId, session, player, set }: StudentGameModuleProps & { readonly set: unknown }) {
  const clock = useTimedGameClock(session);
  const game = useTypingGame({ roomId, session, player, set, disabled: clock.expired });
  const question = game.currentQuestion;
  if (game.loading) return <StatusPanel title="게임 불러오는 중">진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (game.error) return <StatusPanel title="게임 연결 오류" tone="error">{game.error.message}</StatusPanel>;
  if (!question) return game.isComplete
    ? <StatusPanel title="문제를 모두 풀었어요">라운드가 끝날 때까지 잠시 기다려 주세요. 답안을 집계하고 있습니다.</StatusPanel>
    : <StatusPanel title="문제가 없습니다" tone="error">세트에 입력할 수 있는 문장이 없습니다.</StatusPanel>;

  const completed = game.progress.lastResult?.itemId === question.id && game.progress.lastResult.isCorrect;
  const prefix = question.targetText.slice(0, game.comparison.currentPrefixLength);
  const remaining = question.targetText.slice(game.comparison.currentPrefixLength);
  const onChange = (event: ChangeEvent<HTMLTextAreaElement>): void => game.updateInput(event.target.value);

  return <main className={styles.game}>
    <header className={styles.topbar}>
      <div><span>TYPING</span><h1>{game.setTitle}</h1></div>
      <div className={styles.score}><small>완료</small><strong>{game.progress.correctCount}</strong></div>
    </header>

    <section className={styles.metrics} aria-label="타자 통계">
      <div><small>현재 타수</small><strong>{game.speed.currentCpm}</strong><span>CPM</span></div>
      <div><small>평균 타수</small><strong>{game.speed.averageCpm}</strong><span>CPM</span></div>
      <div><small>최고 타수</small><strong>{game.speed.bestCpm}</strong><span>CPM</span></div>
      <div><small>정확도</small><strong>{game.accuracy}</strong><span>%</span></div>
    </section>

    <Card className={styles.typingCard}>
      <div className={styles.cardHeader}>
        <span>{game.currentIndex + 1} / {game.questionCount}</span>
        <p>{question.helperText}</p>
      </div>
      <p className={styles.target} aria-label={`입력할 문장: ${question.targetText}`}>
        <span>{prefix}</span><b data-error={game.comparison.hasError}>{remaining}</b>
      </p>
      <label className={styles.inputLabel}>
        <span>위 문장을 그대로 입력하세요.</span>
        <textarea
          autoFocus
          rows={3}
          value={game.inputText}
          onChange={onChange}
          disabled={game.submitting || completed || clock.expired}
          aria-invalid={game.comparison.hasError}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="여기에 입력"
        />
      </label>
      <div className={styles.feedback} data-tone={completed ? "correct" : game.comparison.hasError ? "error" : "neutral"} role="status">
        {game.submissionError
          ? <><span>{game.submissionError.message}</span><Button variant="ghost" onClick={() => void game.retrySubmission()}>다시 저장</Button></>
          : completed
            ? <><span>정확하게 입력했어요!</span><Button onClick={() => void game.goNext()}>다음 문장</Button></>
            : game.comparison.hasError
              ? "오타를 수정하면 이어서 진행할 수 있어요."
              : "오타는 유효 타수에 포함되지 않습니다."}
      </div>
    </Card>
  </main>;
}

export default function TypingStudentGame(props: StudentGameModuleProps) {
  const learningSet = useTypingSet(props.session);
  if (learningSet.loading) return <StatusPanel title="학습 세트 불러오는 중">이번 게임의 문장을 준비하고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="학습 세트 오류" tone="error">{learningSet.error?.message ?? "선택된 학습 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <TypingPlayArea {...props} set={learningSet.set} />;
}
