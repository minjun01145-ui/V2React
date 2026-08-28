import { useEffect, useState } from "react";
import { GameEffectLayer } from "../../game-engine/effects/GameEffectLayer.tsx";
import { createScoreCelebration } from "../../game-engine/effects/model.ts";
import { useGameEffectEngine } from "../../game-engine/effects/useGameEffectEngine.ts";
import type { StudentGameModuleProps } from "../../game-engine/contracts/gameDefinition.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import { toErrorMessage } from "../../shared/errors/errorMessage.ts";
import { usePopup } from "../../shared/popup/index.ts";
import { LearningCardButton, LearningCardSurface, type LearningCardTone } from "../../shared/ui/LearningCard.tsx";
import { useSimpleQuizGame } from "./useSimpleQuizGame.ts";
import { useSimpleQuizSet } from "./useSimpleQuizSet.ts";
import styles from "./SimpleQuiz.module.css";

const OPTION_MARKERS = ["A", "B", "C", "D", "E"] as const;
const OPTION_TONES: readonly LearningCardTone[] = ["indigo", "mint", "warm", "indigo", "mint"];

export default function SimpleQuizStudentModule({ roomId, session, player }: StudentGameModuleProps) {
  const learningSet = useSimpleQuizSet(session);
  if (learningSet.loading) return <StatusPanel title="심플퀴즈 준비 중">문제와 선택지를 만들고 있습니다.</StatusPanel>;
  if (learningSet.error || !learningSet.set) return <StatusPanel title="단어 세트 오류" tone="error">{learningSet.error?.message ?? "선택한 단어 세트를 찾을 수 없습니다."}</StatusPanel>;
  return <SimpleQuizGame roomId={roomId} session={session} player={player} set={learningSet.set} />;
}

function SimpleQuizGame({ roomId, session, player, set }: {
  readonly roomId: string;
  readonly session: StudentGameModuleProps["session"];
  readonly player: StudentGameModuleProps["player"];
  readonly set: NonNullable<ReturnType<typeof useSimpleQuizSet>["set"]>;
}) {
  const clock = useTimedGameClock(session);
  const game = useSimpleQuizGame({ roomId, session, player, set, disabled: clock.expired });
  const effects = useGameEffectEngine();
  const { showMessage } = usePopup();
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"correct" | "incorrect" | "">("");
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const question = game.currentQuestion;

  useEffect(() => {
    const result = game.progress.lastResult;
    if (!pendingQuestionId || result?.questionId !== pendingQuestionId) return;
    const timer = globalThis.setTimeout(() => {
      void game.nextQuestion()
        .then((advanced) => {
          if (!advanced) return;
          setSelectedOptionId(null);
          setFeedback("");
          setFeedbackTone("");
        })
        .catch(async (error: unknown) => {
          console.error(error);
          await showMessage({ title: "다음 문제로 이동하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 시도해 주세요."), tone: "error", blurBackground: false });
        })
        .finally(() => {
          setPendingQuestionId(null);
          setSubmitting(false);
        });
    }, result.isCorrect ? 720 : 920);
    return () => globalThis.clearTimeout(timer);
  }, [game.nextQuestion, game.progress.lastResult, pendingQuestionId, showMessage]);

  if (game.loading) return <StatusPanel title="심플퀴즈 연결 중">내 진행 상황을 연결하고 있습니다.</StatusPanel>;
  if (game.error) return <StatusPanel title="게임 연결 오류" tone="error">{game.error.message}</StatusPanel>;
  if (!question) return <StatusPanel title="문제가 없습니다" tone="error">서로 다른 답을 가진 단어가 충분한지 확인해 주세요.</StatusPanel>;

  const chooseOption = async (optionId: string): Promise<void> => {
    if (submitting || pendingQuestionId) return;
    setSubmitting(true);
    setSelectedOptionId(optionId);
    try {
      const result = await game.submitAnswer({ optionId });
      if (!result) {
        setSubmitting(false);
        return;
      }
      const correctOption = question.options.find((option) => option.id === question.correctOptionId);
      setFeedback(result.isCorrect ? "정답! 다음 문제가 곧 나옵니다." : `아쉬워요. 정답은 “${correctOption?.text ?? "-"}”입니다.`);
      setFeedbackTone(result.isCorrect ? "correct" : "incorrect");
      if (result.isCorrect) effects.play(createScoreCelebration({ scoreDelta: result.scoreDelta, combo: game.progress.combo + 1 }));
      setPendingQuestionId(question.id);
    } catch (error: unknown) {
      console.error(error);
      setSelectedOptionId(null);
      setSubmitting(false);
      await showMessage({ title: "정답을 제출하지 못했어요", message: toErrorMessage(error, "잠시 후 다시 선택해 주세요."), tone: "error", blurBackground: false });
    }
  };

  return <main className={styles.game}>
    <GameEffectLayer effect={effects.activeEffect} />
    <header className={styles.topbar}>
      <div><span>SIMPLE QUIZ · {game.choiceCount} CHOICES</span><h1>심플퀴즈</h1></div>
      <div className={styles.stats}>
        <div><small>문제</small><strong>{game.currentIndex + 1}<i>/{game.questionCount}</i></strong></div>
        <div><small>콤보</small><strong>{game.progress.combo}</strong></div>
        <div><small>점수</small><strong>{game.progress.score}</strong></div>
      </div>
    </header>

    <LearningCardSurface className={styles.prompt} eyebrow="뜻" marker="?" tone="warm">{question.prompt}</LearningCardSurface>
    <p className={styles.guide}>뜻에 맞는 단어를 빠르게 선택하세요.</p>
    <section className={styles.options} aria-label={`${game.choiceCount}개 선택지`}>
      {question.options.map((option, index) => <LearningCardButton
        className={styles.option}
        eyebrow={`선택지 ${index + 1}`}
        marker={OPTION_MARKERS[index] ?? String(index + 1)}
        tone={OPTION_TONES[index] ?? "indigo"}
        selected={selectedOptionId === option.id}
        disabled={submitting}
        onClick={() => void chooseOption(option.id)}
        key={option.id}
      >{option.text}</LearningCardButton>)}
    </section>
    <div className={styles.feedback} data-tone={feedbackTone} role="status" aria-live="polite">{feedback || "선택하는 즉시 채점됩니다."}</div>
  </main>;
}
