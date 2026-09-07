import { useCallback, useState } from "react";
import { TIMED_GAME_MODE_OPTIONS, isTimedGameMode, type TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import type { QuizGamePlan } from "../../../quiz-game/types.ts";
import type { StudentQuestionConfig } from "../../../student-question-activity/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import { GameSetupPanel } from "./GameSetupPanel.tsx";
import QuizGameLaunchPanel from "./QuizGameLaunchPanel.tsx";
import styles from "./TeacherRoomController.module.css";
import type { GameSetupState } from "./useGameSetup.ts";

type ActivityKind = "game" | "quiz" | "questions" | "latest-questions";

const activityOptions: readonly { readonly id: ActivityKind; readonly label: string }[] = [
  { id: "game", label: "기존 게임" },
  { id: "quiz", label: "퀴즈쇼 모드" },
  { id: "questions", label: "질문 만들기" },
];

export default function ActivityLaunchPanel({
  setup,
  disabled,
  hasPlayers,
  latestQuestionSetId,
  onStartGame,
  onStartQuiz,
  onStartQuestions,
  onStartLatestQuestions,
}: {
  readonly setup: GameSetupState;
  readonly disabled: boolean;
  readonly hasPlayers: boolean;
  readonly latestQuestionSetId: string | null;
  readonly onStartGame: () => Promise<void>;
  readonly onStartQuiz: (plan: QuizGamePlan) => Promise<void>;
  readonly onStartQuestions: (config: StudentQuestionConfig) => Promise<void>;
  readonly onStartLatestQuestions: (setId: string, timedMode: TimedGameMode) => Promise<void>;
}) {
  const [activityKind, setActivityKind] = useState<ActivityKind>("game");
  const [quizPlan, setQuizPlan] = useState<QuizGamePlan | null>(null);
  const [questionCount, setQuestionCount] = useState(1);
  const [englishOnly, setEnglishOnly] = useState(false);
  const handleQuizPlanChange = useCallback((plan: QuizGamePlan | null) => setQuizPlan(plan), []);
  const options = latestQuestionSetId
    ? [...activityOptions, { id: "latest-questions", label: "학생 질문 AI" } as const]
    : activityOptions;

  const invalidSelection = activityKind === "game"
    ? setup.invalidSet
    : activityKind === "quiz"
      ? !quizPlan
      : activityKind === "latest-questions"
        ? !latestQuestionSetId
        : false;

  const startLabel = activityKind === "game"
    ? `${setup.selectedGame.title} 시작`
    : activityKind === "quiz"
      ? quizPlan ? `${quizPlan.name} 시작` : "퀴즈 선택 필요"
      : activityKind === "questions"
        ? "질문 만들기 시작"
        : "학생 질문으로 AI 문답 시작";

  const start = async (): Promise<void> => {
    if (disabled || !hasPlayers || invalidSelection) return;
    if (activityKind === "game") await onStartGame();
    else if (activityKind === "quiz" && quizPlan) await onStartQuiz(quizPlan);
    else if (activityKind === "questions") await onStartQuestions({ questionCount, englishQuestionsOnly: englishOnly });
    else if (activityKind === "latest-questions" && latestQuestionSetId) await onStartLatestQuestions(latestQuestionSetId, setup.timedMode);
  };

  return <Card className={styles.launchPanel}>
    <h2 className={styles.launchTitle}>활동 선택</h2>
    <div className={styles.activityChoices} role="group" aria-label="시작할 수업 활동">
      {options.map((option) => <button type="button" aria-pressed={activityKind === option.id} onClick={() => setActivityKind(option.id)} disabled={disabled} key={option.id}>{option.label}</button>)}
    </div>
    <div className={styles.launchContent}>
      {activityKind === "game" ? <GameSetupPanel setup={setup} disabled={disabled} /> : null}
      {activityKind === "quiz" ? <QuizGameLaunchPanel disabled={disabled} onPlanChange={handleQuizPlanChange} /> : null}
      {activityKind === "questions" ? <div className={styles.questionSetup}>
        <h2>학생 질문 만들기</h2>
        <div className={styles.questionControls}>
          <label>학생당 질문 수<select value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} disabled={disabled}>{[1, 2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}개</option>)}</select></label>
          <label className={styles.checkbox}><input type="checkbox" checked={englishOnly} onChange={(event) => setEnglishOnly(event.target.checked)} disabled={disabled} />영어 질문만 받기</label>
        </div>
      </div> : null}
      {activityKind === "latest-questions" ? <div className={styles.latestQuestionSetup}>
        <div><h2>완성된 학생 질문</h2><Muted>가장 최근에 학생들이 만든 질문 세트로 AI 문답을 진행합니다.</Muted></div>
        <label>게임 시간<select value={setup.timedMode} onChange={(event) => { if (isTimedGameMode(event.target.value)) setup.selectTimedMode(event.target.value); }} disabled={disabled}>{TIMED_GAME_MODE_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.label} 모드</option>)}</select></label>
      </div> : null}
    </div>
    <div className={styles.launchFooter}>
      {!hasPlayers ? <p>학생이 한 명 이상 접속하면 시작할 수 있습니다.</p> : null}
      <Button full disabled={disabled || !hasPlayers || invalidSelection} onClick={() => void start()}>{disabled ? "처리 중…" : startLabel}</Button>
    </div>
  </Card>;
}
