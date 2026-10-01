import { useCallback, useState } from "react";
import type { TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import type { QuizGamePlan } from "../../../quiz-game/types.ts";
import type { StudentQuestionConfig } from "../../../student-question-activity/types.ts";
import type { GameSetupState } from "./useGameSetup.ts";

type ActivityKind = "game" | "quiz" | "questions" | "latest-questions";

const activityOptions: readonly { readonly id: ActivityKind; readonly label: string }[] = [
  { id: "game", label: "게임" },
  { id: "quiz", label: "퀴즈쇼" },
  { id: "questions", label: "질문 만들기" },
];

export function useActivityLaunch({ setup, disabled, hasPlayers, latestQuestionSetId, onStartGame, onStartQuiz, onStartQuestions, onStartLatestQuestions }: {
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
    ? [...activityOptions, { id: "latest-questions", label: "학생 질문으로 AI 문답" } as const]
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

  return { activityKind, setActivityKind, options, quizPlan, handleQuizPlanChange, questionCount, setQuestionCount, englishOnly, setEnglishOnly, invalidSelection, startLabel, start };
}
