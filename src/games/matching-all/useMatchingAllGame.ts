import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import { isMatchingPair, type PairMatchingCard } from "../../game-engine/pair-matching/index.ts";
import { createEmptyProgress, normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import { adaptLearningSetToPairMatching } from "../../learning-sets/pairMatchingAdapter.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt } from "../../multiplayer/game-progress/repository.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { ALL_MATCHING_BASE_SCORE, ALL_MATCHING_PAIR_COUNT, allMatchingRoundResult, createAllMatchingBoard, nextUsedPairIds } from "./engine.ts";

interface MatchingAllDetails {
  readonly combo: number;
  readonly completedPairIds: readonly string[];
}

export interface MatchingAllOutcome {
  readonly id: string;
  readonly scoreDelta: number;
  readonly combo: number;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export function useMatchingAllGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
  readonly disabled?: boolean;
}) {
  const { roomId, session, player, set, disabled = false } = input;
  const pairs = useMemo(() => adaptLearningSetToPairMatching(set), [set]);
  const remoteProgress = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<GameProgress<MatchingAllDetails>>(() => createEmptyProgress());
  const [board, setBoard] = useState<readonly PairMatchingCard[]>(() => createAllMatchingBoard(pairs, [], `${session.roundId}:${player.id}:initial`));
  const [selectedCard, setSelectedCard] = useState<PairMatchingCard | null>(null);
  const [matchedPairIds, setMatchedPairIds] = useState<readonly string[]>([]);
  const [removingCardIds, setRemovingCardIds] = useState<readonly string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"correct" | "incorrect" | "">("");
  const [combo, setCombo] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<MatchingAllOutcome | null>(null);
  const appliedRemoteRef = useRef<{ readonly roundId: string; readonly revision: number } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (remoteProgress.loading) return;
    const applied = appliedRemoteRef.current;
    if (applied?.roundId === session.roundId && applied.revision >= remoteProgress.revision) return;
    const hydrated = normalizeProgress<MatchingAllDetails>(remoteProgress.value, pairs.length);
    setProgress(hydrated);
    setCombo(hydrated.combo);
    setBoard(createAllMatchingBoard(pairs, hydrated.completedItemIds, `${session.roundId}:${player.id}:board:${hydrated.correctCount}`));
    setMatchedPairIds([]);
    if (applied?.roundId !== session.roundId) setLastOutcome(null);
    appliedRemoteRef.current = { roundId: session.roundId, revision: remoteProgress.revision };
  }, [pairs, player.id, remoteProgress.loading, remoteProgress.revision, remoteProgress.value, session.roundId]);

  const persistResult = useCallback(async (correct: boolean, completedPairIds: readonly string[]): Promise<void> => {
    const boardComplete = correct && completedPairIds.length === ALL_MATCHING_PAIR_COUNT;
    const roundResult = allMatchingRoundResult(combo, boardComplete);
    const boardId = `board:${[...new Set(board.map((card) => card.pairId))].sort().join(":")}`;
    const item = { id: boardId, prompt: board.map((card) => card.text).join(" · ") };
    const details: MatchingAllDetails = { combo: roundResult.combo, completedPairIds };
    const result = createAnswerResult({
      isCorrect: boardComplete,
      scoreDelta: roundResult.scoreDelta,
      feedback: boardComplete ? "네 쌍을 모두 찾았습니다!" : "서로 다른 짝입니다.",
      details,
    });
    const attemptId = crypto.randomUUID();
    const usedPairIds = boardComplete ? nextUsedPairIds(progress.completedItemIds, board, pairs.length) : progress.completedItemIds;
    const nextProgress: GameProgress<MatchingAllDetails> = {
      ...progress,
      currentIndex: progress.correctCount + (boardComplete ? 1 : 0),
      score: progress.score + roundResult.scoreDelta,
      correctCount: progress.correctCount + (boardComplete ? 1 : 0),
      attemptCount: progress.attemptCount + 1,
      completedItemIds: usedPairIds,
      lastResult: { itemId: boardId, ...result },
      completedAtMs: null,
    };
    const committedMutation = await persistGameAttempt({
      roomId,
      roundId: session.roundId,
      gameId: session.gameId,
      player,
      attemptId,
      item,
      answer: details,
      result,
      previousProgress: progress,
      progress: nextProgress,
    });
    const committedProgress = normalizeProgress<MatchingAllDetails>(committedMutation.progress, pairs.length);
    appliedRemoteRef.current = { roundId: session.roundId, revision: committedMutation.revision };
    setProgress(committedProgress);
    setCombo(committedProgress.combo);
    if (boardComplete) {
      setLastOutcome({ id: attemptId, scoreDelta: roundResult.scoreDelta, combo: roundResult.combo });
      setBoard(createAllMatchingBoard(pairs, committedProgress.completedItemIds, `${session.roundId}:${player.id}:board:${committedProgress.correctCount}`));
      setMatchedPairIds([]);
      setFeedback("판 완성! 새로운 8장의 카드가 나왔어요.");
      setFeedbackTone("correct");
    } else {
      setFeedback("서로 다른 짝이에요. 콤보가 초기화됐어요.");
      setFeedbackTone("incorrect");
    }
  }, [board, combo, pairs, player, progress, roomId, session.gameId, session.roundId]);

  const submitPair = useCallback(async (first: PairMatchingCard, second: PairMatchingCard): Promise<void> => {
    if (busyRef.current || disabled) return;
    busyRef.current = true;
    const correct = isMatchingPair(first, second);
    if (correct) setRemovingCardIds([first.id, second.id]);
    try {
      await wait(correct ? 340 : 300);
      if (!correct) {
        await persistResult(false, matchedPairIds);
        return;
      }
      const completedPairIds = [...matchedPairIds, first.pairId];
      if (completedPairIds.length === ALL_MATCHING_PAIR_COUNT) {
        await persistResult(true, completedPairIds);
      } else {
        setMatchedPairIds(completedPairIds);
        setFeedback(`좋아요! ${completedPairIds.length}/4쌍을 찾았습니다. 점수는 판을 완성하면 받아요.`);
        setFeedbackTone("correct");
      }
    } catch (error: unknown) {
      console.error(error);
      setFeedback("결과를 저장하지 못했어요. 잠시 후 다시 눌러주세요.");
      setFeedbackTone("incorrect");
    } finally {
      setSelectedCard(null);
      setRemovingCardIds([]);
      busyRef.current = false;
    }
  }, [disabled, matchedPairIds, persistResult]);

  const selectCard = useCallback((card: PairMatchingCard): void => {
    if (busyRef.current || disabled || matchedPairIds.includes(card.pairId)) return;
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
  }, [disabled, matchedPairIds, selectedCard, submitPair]);

  return {
    board,
    progress,
    selectedCardId: selectedCard?.id ?? null,
    matchedPairIds,
    removingCardIds,
    feedback,
    feedbackTone,
    loading: remoteProgress.loading,
    error: remoteProgress.error,
    combo,
    lastOutcome,
    baseScore: ALL_MATCHING_BASE_SCORE,
    selectCard,
  };
}
