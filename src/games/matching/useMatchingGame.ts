import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAnswerResult } from "../../game-engine/core/answerResult.ts";
import {
  beginLogicalOperation,
  completeLogicalOperation,
  LogicalOperationConflictError,
  logicalOperationKey,
  type PendingLogicalOperation,
} from "../../game-engine/core/logicalOperation.ts";
import { isMatchingPair, type PairMatchingCard } from "../../game-engine/pair-matching/index.ts";
import { applyResultToProgress, createEmptyProgress, normalizeProgress, type GameProgress } from "../../game-engine/progress/index.ts";
import type { LearningSet } from "../../learning-sets/types.ts";
import { adaptLearningSetToPairMatching } from "../../learning-sets/pairMatchingAdapter.ts";
import { usePlayerGameProgress } from "../../multiplayer/game-progress/hooks.ts";
import { persistGameAttempt, type GameAttemptSubmission } from "../../multiplayer/game-progress/repository.ts";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";
import { createMatchingBoard, matchingComboResult, refillMatchingBoard } from "./engine.ts";

interface MatchingDetails {
  readonly firstCardId: string;
  readonly secondCardId: string;
  readonly combo: number;
}

export interface MatchingOutcome {
  readonly id: string;
  readonly isCorrect: boolean;
  readonly scoreDelta: number;
  readonly combo: number;
}

const wait = (milliseconds: number) => new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));

export function useMatchingGame(input: {
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
  readonly set: LearningSet;
  readonly disabled?: boolean;
}) {
  const { roomId, session, player, set, disabled = false } = input;
  const pairs = useMemo(() => adaptLearningSetToPairMatching(set), [set]);
  const remoteProgress = usePlayerGameProgress(roomId, session.roundId, player.id);
  const [progress, setProgress] = useState<GameProgress<MatchingDetails>>(() => createEmptyProgress());
  const [board, setBoard] = useState<readonly PairMatchingCard[]>(() => createMatchingBoard(pairs, [], `${session.roundId}:${player.id}:initial`));
  const [selectedCard, setSelectedCard] = useState<PairMatchingCard | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"correct" | "incorrect" | "">("");
  const [removingCardIds, setRemovingCardIds] = useState<readonly string[]>([]);
  const [combo, setCombo] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<MatchingOutcome | null>(null);
  const appliedRemoteRef = useRef<{ readonly roundId: string; readonly revision: number } | null>(null);
  const pendingOperationRef = useRef<PendingLogicalOperation<Omit<GameAttemptSubmission<
    { readonly id: string; readonly prompt: string },
    MatchingDetails,
    MatchingDetails
  >, "attemptId">> | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (remoteProgress.loading) return;
    if (remoteProgress.lastOperationId) {
      pendingOperationRef.current = completeLogicalOperation(pendingOperationRef.current, remoteProgress.lastOperationId);
    }
    const applied = appliedRemoteRef.current;
    if (applied?.roundId === session.roundId && applied.revision >= remoteProgress.revision) return;
    const hydrated = normalizeProgress<MatchingDetails>(remoteProgress.value, pairs.length);
    setProgress(hydrated);
    if (applied?.roundId !== session.roundId) setLastOutcome(null);
    setCombo(hydrated.combo);
    setBoard(createMatchingBoard(pairs, hydrated.completedItemIds, `${session.roundId}:${player.id}:${hydrated.completedItemIds.join(",")}`));
    appliedRemoteRef.current = { roundId: session.roundId, revision: remoteProgress.revision };
  }, [pairs, player.id, remoteProgress.loading, remoteProgress.revision, remoteProgress.value, session.roundId]);

  const submitPair = useCallback(async (first: PairMatchingCard, second: PairMatchingCard): Promise<void> => {
    if (busyRef.current || disabled) return;
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
      const item = { id: pair.id, prompt: `${pair.term} ↔ ${pair.meaning}` };
      const comboResult = matchingComboResult(combo, correct);
      const nextCombo = comboResult.combo;
      const details: MatchingDetails = { firstCardId: first.id, secondCardId: second.id, combo: nextCombo };
      const result = createAnswerResult({
        isCorrect: correct,
        scoreDelta: comboResult.scoreDelta,
        feedback: correct ? "짝을 찾았어요!" : "서로 다른 짝입니다.",
        details,
      });
      const applied = applyResultToProgress(progress, pair.id, result);
      const completedCount = applied.completedItemIds.length;
      const cycleComplete = correct && completedCount >= pairs.length;
      const nextProgress: GameProgress<MatchingDetails> = {
        ...applied,
        currentIndex: applied.correctCount,
        completedItemIds: cycleComplete ? [] : applied.completedItemIds,
        completedAtMs: null,
      };
      const boardKey = board.map((card) => card.id).sort();
      const selectedCardIds = [first.id, second.id].sort();
      const logicalKey = logicalOperationKey(["matching-pair", session.roundId, boardKey, selectedCardIds]);
      const pending = beginLogicalOperation({
        pending: pendingOperationRef.current,
        logicalKey,
        createPayload: () => ({ item, answer: details, result, previousProgress: progress, progress: nextProgress }),
      });
      pendingOperationRef.current = pending;
      const committedMutation = await persistGameAttempt({
        roomId,
        roundId: session.roundId,
        gameId: session.gameId,
        player,
        attemptId: pending.operationId,
        ...pending.payload,
      });
      pendingOperationRef.current = completeLogicalOperation(pendingOperationRef.current, pending.operationId);
      const committedProgress = normalizeProgress<MatchingDetails>(committedMutation.progress, pairs.length);
      appliedRemoteRef.current = { roundId: session.roundId, revision: committedMutation.revision };
      if (correct) setBoard(cycleComplete
        ? createMatchingBoard(pairs, [], `${session.roundId}:${player.id}:cycle:${applied.correctCount}`)
        : refillMatchingBoard(board, pair.id, pairs, committedProgress.completedItemIds, `${session.roundId}:${completedCount}`));
      setProgress(committedProgress);
      setCombo(committedProgress.combo);
      setLastOutcome({ id: pending.operationId, isCorrect: correct, scoreDelta: comboResult.scoreDelta, combo: nextCombo });
      setFeedback(correct ? "정답! 새로운 카드가 들어왔어요." : "서로 다른 짝이에요. 다시 찾아보세요!");
      setFeedbackTone(correct ? "correct" : "incorrect");
    } catch (error: unknown) {
      console.error(error);
      setFeedback(error instanceof LogicalOperationConflictError
        ? error.message
        : "결과를 저장하지 못했어요. 잠시 후 다시 눌러주세요.");
      setFeedbackTone("incorrect");
    } finally {
      setSelectedCard(null);
      setRemovingCardIds([]);
      busyRef.current = false;
    }
  }, [board, combo, disabled, pairs, player, progress, roomId, session.gameId, session.roundId]);

  const selectCard = useCallback((card: PairMatchingCard): void => {
    if (busyRef.current || disabled) return;
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
  }, [disabled, selectedCard, submitPair]);

  return {
    board,
    progress,
    selectedCardId: selectedCard?.id ?? null,
    removingCardIds,
    feedback,
    feedbackTone,
    loading: remoteProgress.loading,
    error: remoteProgress.error,
    combo,
    lastOutcome,
    pairCount: pairs.length,
    selectCard,
  };
}
