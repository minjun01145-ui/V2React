import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import { usePlayerGameProgress } from "../../game-engine/question-engine/multiplayer/hooks.ts";
import { persistAnswerAttempt } from "../../game-engine/question-engine/multiplayer/repository.ts";
import { applyAnswerToProgress, createEmptyProgress, normalizeProgress } from "../../game-engine/question-engine/progress.ts";
import type { BaseQuestion, GameProgress } from "../../game-engine/question-engine/types.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { createMatchingBoard, isMatchingPair, matchingPairs, refillMatchingBoard, type MatchingCard } from "./engine.ts";

interface MatchingDetails {
  readonly firstCardId: string;
  readonly secondCardId: string;
}

interface MatchingQuestion extends BaseQuestion {
  readonly prompt: string;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export function useMatchingGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
}) {
  const { roomId, session, player, set } = input;
  const pairs = useMemo(() => matchingPairs(set), [set]);
  const remoteProgress = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<GameProgress<MatchingDetails>>(() => createEmptyProgress());
  const [board, setBoard] = useState<readonly MatchingCard[]>(() => createMatchingBoard(pairs, [], `${session.roundId}:${player.id}:initial`));
  const [selectedCard, setSelectedCard] = useState<MatchingCard | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"correct" | "incorrect" | "">("");
  const [removingCardIds, setRemovingCardIds] = useState<readonly string[]>([]);
  const hydratedRoundRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (remoteProgress.loading || hydratedRoundRef.current === session.roundId) return;
    const hydrated = normalizeProgress<MatchingDetails>(remoteProgress.value, pairs.length);
    setProgress(hydrated);
    setBoard(createMatchingBoard(pairs, hydrated.completedQuestionIds, `${session.roundId}:${player.id}:${hydrated.completedQuestionIds.join(",")}`));
    hydratedRoundRef.current = session.roundId;
  }, [pairs.length, remoteProgress.loading, remoteProgress.value, session.roundId]);

  const isComplete = progress.completedQuestionIds.length >= pairs.length;

  const submitPair = useCallback(async (first: MatchingCard, second: MatchingCard): Promise<void> => {
    if (busyRef.current) return;
    busyRef.current = true;
    const correct = isMatchingPair(first, second);
    if (correct) setRemovingCardIds([first.id, second.id]);
    else {
      setFeedback("서로 다른 짝이에요. 다시 찾아보세요!");
      setFeedbackTone("incorrect");
    }
    try {
      await wait(correct ? 380 : 340);
      const pair = pairs.find((candidate) => candidate.id === first.pairId) ?? pairs[0];
      if (!pair) return;
      const question: MatchingQuestion = { id: pair.id, prompt: `${pair.term} ↔ ${pair.meaning}` };
      const details: MatchingDetails = { firstCardId: first.id, secondCardId: second.id };
      const result = createAnswerResult({
        isCorrect: correct,
        scoreDelta: correct ? 100 : 0,
        feedback: correct ? "짝을 찾았어요!" : "서로 다른 짝입니다.",
        details,
      });
      const applied = applyAnswerToProgress(progress, question, result);
      const completedCount = applied.completedQuestionIds.length;
      const nextProgress: GameProgress<MatchingDetails> = {
        ...applied,
        currentIndex: completedCount,
        completedAtMs: completedCount >= pairs.length ? Date.now() : null,
      };
      await persistAnswerAttempt({
        roomId,
        roundId: session.roundId,
        gameId: session.gameId,
        player,
        attemptId: crypto.randomUUID(),
        question,
        answer: details,
        result,
        progress: nextProgress,
      });
      if (correct) setBoard(refillMatchingBoard(board, pair.id, pairs, nextProgress.completedQuestionIds, `${session.roundId}:${completedCount}`));
      setProgress(nextProgress);
      setFeedback(correct ? "정답! 새로운 카드가 들어왔어요." : "서로 다른 짝이에요. 다시 찾아보세요!");
      setFeedbackTone(correct ? "correct" : "incorrect");
    } catch (error: unknown) {
      console.error(error);
      setFeedback("결과를 저장하지 못했어요. 잠시 후 다시 눌러주세요.");
      setFeedbackTone("incorrect");
    } finally {
      setSelectedCard(null);
      setRemovingCardIds([]);
      busyRef.current = false;
    }
  }, [board, pairs, player, progress, roomId, session.gameId, session.roundId]);

  const selectCard = useCallback((card: MatchingCard): void => {
    if (busyRef.current || isComplete) return;
    if (!selectedCard) {
      setSelectedCard(card);
      setFeedback("");
      setFeedbackTone("");
      return;
    }
    if (selectedCard.id === card.id) {
      setSelectedCard(null);
      return;
    }
    if (selectedCard.kind === card.kind) {
      setSelectedCard(card);
      return;
    }
    void submitPair(selectedCard, card);
  }, [isComplete, selectedCard, submitPair]);

  return {
    board,
    progress,
    selectedCardId: selectedCard?.id ?? null,
    removingCardIds,
    feedback,
    feedbackTone,
    loading: remoteProgress.loading,
    error: remoteProgress.error,
    isComplete,
    pairCount: pairs.length,
    selectCard,
  };
}
