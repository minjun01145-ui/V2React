import type { AnswerResult } from "../../../game-engine/core/types.ts";
import type { MultipleChoiceEvaluationDetails, MultipleChoiceQuestion } from "../../../game-engine/question-engine/multiple-choice/index.ts";
import type { PokemonItemId } from "../../../student-data/pokemon-catch/types.ts";
import { itemDefinition } from "../itemRules.ts";
import styles from "../PokemonCatch.module.css";

interface Props {
  readonly question: MultipleChoiceQuestion;
  readonly currentIndex: number;
  readonly questionCount: number;
  readonly currentResult: AnswerResult<MultipleChoiceEvaluationDetails> | null;
  readonly reward: PokemonItemId | null;
  readonly feedback: string;
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onAnswer: (optionId: string) => void;
  readonly onContinue: () => void;
}

export function QuizDialog({ question, currentIndex, questionCount, currentResult, reward, feedback, submitting, onClose, onAnswer, onContinue }: Props) {
  return <div className={styles.modalBackdrop} role="dialog" aria-modal="true" aria-label="단어 퀴즈"><section className={styles.quizCard}>
    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="닫기">×</button>
    <span className={styles.quizStep}>WORD {currentIndex + 1} / {questionCount}</span>
    <p>정답을 맞히면 아이템 하나를 얻습니다.</p><h2>{question.prompt}</h2>
    <div className={styles.options}>{question.options.map((option, index) => <button type="button" key={option.id} onClick={() => onAnswer(option.id)} disabled={submitting || Boolean(currentResult?.isCorrect)} data-state={currentResult ? (option.id === question.correctOptionId ? "correct" : currentResult.details?.selectedOptionId === option.id ? "wrong" : "") : ""}><span>{index + 1}</span>{option.text}</button>)}</div>
    {reward ? <div className={styles.rewardCard}><strong>{itemDefinition(reward).name}</strong><span>가방에 저장되었습니다.</span></div> : null}
    {feedback ? <div className={styles.quizFeedback} data-correct={Boolean(currentResult?.isCorrect)}>{feedback}</div> : null}
    {currentResult?.isCorrect ? <button type="button" className={styles.continueButton} onClick={onContinue} disabled={submitting}>{currentIndex + 1 >= questionCount ? "문제 완료" : "계속 탐험하기"}</button> : null}
  </section></div>;
}
