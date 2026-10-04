import { useCallback, useState } from "react";
import type { TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import type { SlideShow } from "../../../slide-show/types.ts";
import type { StudentQuestionConfig } from "../../../student-question-activity/types.ts";
import type { GameSetupState } from "./useGameSetup.ts";

type ActivityKind = "game" | "slide-show" | "questions" | "latest-questions";

const activityOptions: readonly { readonly id: ActivityKind; readonly label: string }[] = [
  { id: "game", label: "게임" },
  { id: "slide-show", label: "슬라이드쇼" },
  { id: "questions", label: "질문 만들기" },
];

export function useActivityLaunch({ setup, disabled, hasPlayers, latestQuestionSetId, onStartGame, onStartSlideShow, onStartQuestions, onStartLatestQuestions }: {
  readonly setup: GameSetupState;
  readonly disabled: boolean;
  readonly hasPlayers: boolean;
  readonly latestQuestionSetId: string | null;
  readonly onStartGame: () => Promise<void>;
  readonly onStartSlideShow: (show: SlideShow) => Promise<void>;
  readonly onStartQuestions: (config: StudentQuestionConfig) => Promise<void>;
  readonly onStartLatestQuestions: (setId: string, timedMode: TimedGameMode) => Promise<void>;
}) {
  const [activityKind, setActivityKind] = useState<ActivityKind>("game");
  const [slideShow, setSlideShow] = useState<SlideShow | null>(null);
  const [questionCount, setQuestionCount] = useState(1);
  const [englishOnly, setEnglishOnly] = useState(false);
  const handleSlideShowChange = useCallback((show: SlideShow | null) => setSlideShow(show), []);
  const options = latestQuestionSetId
    ? [...activityOptions, { id: "latest-questions", label: "학생 질문으로 AI 문답" } as const]
    : activityOptions;

  const invalidSelection = activityKind === "game"
    ? setup.invalidSet
    : activityKind === "slide-show"
      ? !slideShow
      : activityKind === "latest-questions"
        ? !latestQuestionSetId
        : false;

  const startLabel = activityKind === "game"
    ? `${setup.selectedGame.title} 시작`
    : activityKind === "slide-show"
      ? slideShow ? `${slideShow.name} 재생` : "슬라이드쇼 선택 필요"
      : activityKind === "questions"
        ? "질문 만들기 시작"
        : "학생 질문으로 AI 문답 시작";

  const start = async (): Promise<void> => {
    if (disabled || !hasPlayers || invalidSelection) return;
    if (activityKind === "game") await onStartGame();
    else if (activityKind === "slide-show" && slideShow) await onStartSlideShow(slideShow);
    else if (activityKind === "questions") await onStartQuestions({ questionCount, englishQuestionsOnly: englishOnly });
    else if (activityKind === "latest-questions" && latestQuestionSetId) await onStartLatestQuestions(latestQuestionSetId, setup.timedMode);
  };

  return { activityKind, setActivityKind, options, slideShow, handleSlideShowChange, questionCount, setQuestionCount, englishOnly, setEnglishOnly, invalidSelection, startLabel, start };
}
