import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TypingQuestion, TypingQuestionSet, TypingSpeedStats } from "./types.ts";
import type { WaitingTypingConfig } from "./waitingTypingConfig.ts";
import { createTypingSpeedTracker, getNewValidProgress, isTypingAnswerComplete } from "./typingEngine.ts";
import { ACID_RAIN_MAX_STAGE, getAcidRainStageRule, shuffledQuestionIndex } from "./acidRainEngine.ts";

export type TypingPracticeStatus = "playing" | "stage-clear" | "game-over" | "complete";

export interface FallingTypingWord {
  readonly id: string;
  readonly question: TypingQuestion;
  readonly leftPercent: number;
  readonly durationMs: number;
}

export function useTypingPracticeGame(questionSet: TypingQuestionSet, config: WaitingTypingConfig) {
  const [stage, setStage] = useState(1);
  const [status, setStatus] = useState<TypingPracticeStatus>("playing");
  const [words, setWords] = useState<readonly FallingTypingWord[]>([]);
  const [input, setInput] = useState("");
  const [hits, setHits] = useState(0);
  const [lives, setLives] = useState(3);
  const [speed, setSpeed] = useState<TypingSpeedStats>({ currentCpm: 0, averageCpm: 0, bestCpm: 0, totalValidStrokes: 0 });
  const sequence = useRef(0);
  const maxPrefix = useRef(0);
  const trackedWordId = useRef<string | null>(null);
  const livesRef = useRef(3);
  const tracker = useRef(createTypingSpeedTracker());
  const rule = useMemo(() => getAcidRainStageRule(stage), [stage]);

  const spawnWord = useCallback(() => {
    setWords((current) => {
      if (status !== "playing" || current.length >= rule.maxVisibleWords || questionSet.questions.length === 0) return current;
      const question = questionSet.questions[shuffledQuestionIndex(questionSet.questions.length)];
      if (!question) return current;
      sequence.current += 1;
      return [...current, {
        id: `${stage}:${sequence.current}`,
        question,
        leftPercent: 5 + (Math.random() * 76),
        durationMs: rule.fallDurationMs,
      }];
    });
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
      ?? words.find((word) => word.question.targetText.toLocaleLowerCase().startsWith(nextInput.toLocaleLowerCase()))
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
    setInput("");
    maxPrefix.current = 0;
    trackedWordId.current = null;
    const nextHits = hits + 1;
    setHits(nextHits);
    if (nextHits >= rule.targetHits) {
      setWords([]);
      setStatus(stage >= ACID_RAIN_MAX_STAGE ? "complete" : "stage-clear");
    }
  }, [config.ignoreCase, config.ignorePunctuation, hits, rule.targetHits, stage, status, words]);

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
    setInput("");
    maxPrefix.current = 0;
    tracker.current.reset();
    setSpeed(tracker.current.getStats());
    setStatus("playing");
  }, []);

  return { stage, status, words, input, hits, lives, speed, rule, updateInput, missWord, nextStage, restart };
}
