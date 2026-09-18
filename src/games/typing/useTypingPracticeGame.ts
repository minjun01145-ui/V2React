import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TypingQuestion, TypingQuestionSet, TypingSpeedStats } from "./types.ts";
import type { WaitingTypingConfig } from "./waitingTypingConfig.ts";
import { createTypingSpeedTracker, getNewValidProgress, getTypingComparisonState, isTypingAnswerComplete } from "./typingEngine.ts";
import {
  ACID_RAIN_ITEM_KIND,
  ACID_RAIN_MAX_STAGE,
  availableAcidRainLane,
  getAcidRainFallDuration,
  getAcidRainStageRule,
  randomAcidRainItem,
  shouldSpawnAcidRainItem,
  shuffledQuestionIndex,
  type AcidRainItemKind,
} from "./acidRainEngine.ts";
import {
  acidRainItemEffect,
  acidRainPersistentItemId,
  type AcidRainItemStore,
  type AcidRainPersistentItemId,
} from "./acidRainSharedItems.ts";

export type TypingPracticeStatus = "playing" | "stage-clear" | "game-over" | "complete";

export interface FallingTypingWord {
  readonly id: string;
  readonly question: TypingQuestion;
  readonly lane: number;
  readonly durationMs: number;
  readonly itemKind: AcidRainItemKind | null;
  readonly spawnedAt: number;
}

export interface ClearedTypingWord {
  readonly id: string;
  readonly label: string;
  readonly lane: number;
  readonly itemKind: AcidRainItemKind | null;
  readonly progress: number;
}

export type TypingPracticeEvent =
  | { readonly id: number; readonly kind: "bomb-collected" }
  | { readonly id: number; readonly kind: "heart-collected" }
  | { readonly id: number; readonly kind: "ice-collected" }
  | { readonly id: number; readonly kind: "candy-collected" }
  | { readonly id: number; readonly kind: "bomb-used"; readonly clearedCount: number }
  | { readonly id: number; readonly kind: "ice-used"; readonly slot: 2 }
  | { readonly id: number; readonly kind: "empty-slot"; readonly slot: 1 | 2 };

type TypingPracticeEventInput<T = TypingPracticeEvent> = T extends unknown ? Omit<T, "id"> : never;

export function useTypingPracticeGame(
  questionSet: TypingQuestionSet,
  config: WaitingTypingConfig,
  itemStore?: AcidRainItemStore,
) {
  const [stage, setStage] = useState(1);
  const [status, setStatus] = useState<TypingPracticeStatus>("playing");
  const [words, setWords] = useState<readonly FallingTypingWord[]>([]);
  const [input, setInput] = useState("");
  const [hits, setHits] = useState(0);
  const [lives, setLives] = useState(3);
  const [speed, setSpeed] = useState<TypingSpeedStats>({ currentCpm: 0, averageCpm: 0, bestCpm: 0, totalValidStrokes: 0 });
  const [localInventory, setLocalInventory] = useState({ bomb: 0, ice: 0 });
  const [clearedWords, setClearedWords] = useState<readonly ClearedTypingWord[]>([]);
  const [lastEvent, setLastEvent] = useState<TypingPracticeEvent | null>(null);
  const [iceActive, setIceActive] = useState(false);
  const [itemUsePending, setItemUsePending] = useState(false);
  const wordsRef = useRef<readonly FallingTypingWord[]>([]);
  const sequence = useRef(0);
  const eventSequence = useRef(0);
  const maxPrefix = useRef(0);
  const trackedWordId = useRef<string | null>(null);
  const livesRef = useRef(3);
  const lastItemSpawnedAt = useRef(Date.now());
  const iceTimer = useRef<number | null>(null);
  const tracker = useRef(createTypingSpeedTracker());
  const rule = useMemo(() => getAcidRainStageRule(stage), [stage]);
  const inventory = itemStore?.inventory ?? localInventory;

  useEffect(() => { wordsRef.current = words; }, [words]);

  const publishEvent = useCallback((event: TypingPracticeEventInput): void => {
    eventSequence.current += 1;
    setLastEvent({ ...event, id: eventSequence.current } as TypingPracticeEvent);
  }, []);

  const addClearEffects = useCallback((cleared: readonly FallingTypingWord[]): void => {
    if (cleared.length === 0) return;
    setClearedWords((current) => [...current, ...cleared.map((word) => ({
      id: `clear:${word.id}`,
      label: word.question.targetText,
      lane: word.lane,
      itemKind: word.itemKind,
      progress: Math.min(0.9, Math.max(0, (Date.now() - word.spawnedAt) / word.durationMs)),
    }))]);
  }, []);

  const removeClearEffect = useCallback((id: string): void => {
    setClearedWords((current) => current.filter((word) => word.id !== id));
  }, []);

  const registerHits = useCallback((count: number): void => {
    if (count <= 0) return;
    setHits((current) => {
      const nextHits = current + count;
      if (nextHits >= rule.targetHits) {
        setWords([]);
        setStatus(stage >= ACID_RAIN_MAX_STAGE ? "complete" : "stage-clear");
      }
      return Math.min(nextHits, rule.targetHits);
    });
  }, [rule.targetHits, stage]);

  const grantPersistentItem = useCallback((itemId: AcidRainPersistentItemId): void => {
    if (itemStore) {
      void itemStore.grant(itemId);
      return;
    }
    setLocalInventory((current) => ({ ...current, [itemId]: current[itemId] + 1 }));
  }, [itemStore]);

  const consumePersistentItem = useCallback(async (itemId: AcidRainPersistentItemId): Promise<boolean> => {
    if (itemStore) return itemStore.consume(itemId);
    if (localInventory[itemId] <= 0) return false;
    setLocalInventory((current) => ({ ...current, [itemId]: Math.max(0, current[itemId] - 1) }));
    return true;
  }, [itemStore, localInventory]);

  const collectItem = useCallback((itemKind: AcidRainItemKind | null): void => {
    const persistentItemId = acidRainPersistentItemId(itemKind);
    if (persistentItemId) grantPersistentItem(persistentItemId);

    if (itemKind === ACID_RAIN_ITEM_KIND.BOMB) {
      publishEvent({ kind: "bomb-collected" });
    } else if (itemKind === ACID_RAIN_ITEM_KIND.HEART) {
      const nextLives = livesRef.current + 1;
      livesRef.current = nextLives;
      setLives(nextLives);
      publishEvent({ kind: "heart-collected" });
    } else if (itemKind === ACID_RAIN_ITEM_KIND.ICE) {
      publishEvent({ kind: "ice-collected" });
    } else if (itemKind === ACID_RAIN_ITEM_KIND.CANDY) {
      publishEvent({ kind: "candy-collected" });
    }
  }, [grantPersistentItem, publishEvent]);

  const spawnWord = useCallback(() => {
    const current = wordsRef.current;
    if (status !== "playing" || current.length >= rule.maxVisibleWords || questionSet.questions.length === 0) return;
    const question = questionSet.questions[shuffledQuestionIndex(questionSet.questions.length)];
    if (!question) return;
    const now = Date.now();
    const itemKind = shouldSpawnAcidRainItem(lastItemSpawnedAt.current, now) ? randomAcidRainItem() : null;
    if (itemKind) lastItemSpawnedAt.current = now;
    sequence.current += 1;
    setWords([...current, {
      id: `${stage}:${sequence.current}`,
      question,
      lane: availableAcidRainLane(current.map((word) => word.lane)),
      durationMs: getAcidRainFallDuration(question.targetText, rule.fallDurationMs),
      itemKind,
      spawnedAt: now,
    }]);
  }, [questionSet.questions, rule.fallDurationMs, rule.maxVisibleWords, stage, status]);

  useEffect(() => {
    if (status !== "playing") return;
    spawnWord();
    const timer = window.setInterval(spawnWord, rule.spawnIntervalMs);
    return () => window.clearInterval(timer);
  }, [rule.spawnIntervalMs, spawnWord, status]);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = window.setInterval(() => setSpeed(tracker.current.getStats()), 500);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => () => {
    if (iceTimer.current !== null) window.clearTimeout(iceTimer.current);
  }, []);

  const missWord = useCallback((wordId: string) => {
    setWords((current) => current.filter((word) => word.id !== wordId));
    const nextLives = Math.max(0, livesRef.current - 1);
    livesRef.current = nextLives;
    setLives(nextLives);
    if (nextLives === 0) {
      setStatus("game-over");
      setWords([]);
    }
  }, []);

  const updateInput = useCallback((nextInput: string) => {
    if (status !== "playing") return;
    const comparisonOptions = { ignoreCase: config.ignoreCase, ignorePunctuation: config.ignorePunctuation };
    const matchedWord = words.find((word) => isTypingAnswerComplete(word.question.targetText, nextInput, comparisonOptions));
    const prefixWord = matchedWord
      ?? words.find((word) => {
        const comparison = getTypingComparisonState(word.question.targetText, nextInput, comparisonOptions);
        return comparison.inputUnits.length > 0
          && !comparison.hasError
          && comparison.matchedUnitCount === comparison.inputUnits.length;
      })
      ?? words[0];
    if (trackedWordId.current !== (prefixWord?.id ?? null) || nextInput.length === 0) maxPrefix.current = 0;
    trackedWordId.current = prefixWord?.id ?? null;
    const prefixTarget = prefixWord?.question.targetText ?? "";
    const progress = getNewValidProgress(prefixTarget, nextInput, maxPrefix.current, comparisonOptions);
    tracker.current.addValidText(progress.newlyValidText);
    maxPrefix.current = progress.maxPrefixLength;
    setSpeed(tracker.current.getStats());
    if (!matchedWord) {
      setInput(nextInput);
      return;
    }
    setWords((current) => current.filter((word) => word.id !== matchedWord.id));
    addClearEffects([matchedWord]);
    collectItem(matchedWord.itemKind);
    setInput("");
    maxPrefix.current = 0;
    trackedWordId.current = null;
    registerHits(1);
  }, [addClearEffects, collectItem, config.ignoreCase, config.ignorePunctuation, registerHits, status, words]);

  const useItem = useCallback(async (slot: 1 | 2): Promise<void> => {
    setInput("");
    maxPrefix.current = 0;
    trackedWordId.current = null;
    if (status !== "playing" || itemUsePending) return;

    const itemId: AcidRainPersistentItemId = slot === 1 ? "bomb" : "ice";
    if (inventory[itemId] <= 0 || (itemId === "bomb" && words.length === 0)) {
      publishEvent({ kind: "empty-slot", slot });
      return;
    }

    setItemUsePending(true);
    try {
      if (!await consumePersistentItem(itemId)) {
        publishEvent({ kind: "empty-slot", slot });
        return;
      }

      const effect = acidRainItemEffect(itemId);
      if (effect.kind === "clear-all") {
        addClearEffects(words);
        setWords([]);
        registerHits(words.length);
        publishEvent({ kind: "bomb-used", clearedCount: words.length });
        return;
      }

      if (iceTimer.current !== null) window.clearTimeout(iceTimer.current);
      setIceActive(true);
      iceTimer.current = window.setTimeout(() => {
        setIceActive(false);
        iceTimer.current = null;
      }, effect.durationMs);
      publishEvent({ kind: "ice-used", slot: 2 });
    } finally {
      setItemUsePending(false);
    }
  }, [
    addClearEffects,
    consumePersistentItem,
    inventory,
    itemUsePending,
    publishEvent,
    registerHits,
    status,
    words,
  ]);

  const nextStage = useCallback(() => {
    if (status !== "stage-clear") return;
    setStage((current) => Math.min(ACID_RAIN_MAX_STAGE, current + 1));
    setHits(0);
    setLives(3);
    livesRef.current = 3;
    setInput("");
    maxPrefix.current = 0;
    setStatus("playing");
  }, [status]);

  const restart = useCallback(() => {
    setStage(1);
    setHits(0);
    setLives(3);
    livesRef.current = 3;
    setWords([]);
    setClearedWords([]);
    setInput("");
    maxPrefix.current = 0;
    if (!itemStore) setLocalInventory({ bomb: 0, ice: 0 });
    setLastEvent(null);
    lastItemSpawnedAt.current = Date.now();
    if (iceTimer.current !== null) window.clearTimeout(iceTimer.current);
    iceTimer.current = null;
    setIceActive(false);
    setItemUsePending(false);
    tracker.current.reset();
    setSpeed(tracker.current.getStats());
    setStatus("playing");
  }, [itemStore]);

  return {
    stage, status, words, clearedWords, input, activeWordId: trackedWordId.current, hits, lives, speed, rule,
    inventory, iceActive, itemUsePending, lastEvent, updateInput, useItem, missWord, removeClearEffect, nextStage, restart,
  };
}
