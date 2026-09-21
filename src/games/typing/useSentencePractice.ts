import { useEffect, useRef, useState } from "react";
import { createTypingSpeedTracker, getNewValidProgress, getTypingComparisonState } from "./typingEngine.ts";
import type { TypingComparisonOptions, TypingQuestionSet } from "./types.ts";

export function useSentencePractice(set: TypingQuestionSet, options: TypingComparisonOptions) {
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const tracker = useRef(createTypingSpeedTracker());
  const started = useRef(false);
  const maximum = useRef(0);
  const [speed, setSpeed] = useState(() => tracker.current.getStats());
  const question = set.questions[index];
  const comparison = getTypingComparisonState(question?.targetText ?? "", input, options);

  useEffect(() => {
    if (completedAt !== null) return;
    const timer = window.setInterval(() => {
      if (started.current) setSpeed(tracker.current.getStats());
    }, 250);
    return () => window.clearInterval(timer);
  }, [completedAt]);

  function updateInput(value: string) {
    if (!question || completedAt !== null) return;
    if (!started.current && value.length > 0) {
      tracker.current.reset();
      started.current = true;
    }
    const progress = getNewValidProgress(question.targetText, value, maximum.current, options);
    maximum.current = progress.maxPrefixLength;
    tracker.current.addValidText(progress.newlyValidText);
    setSpeed(tracker.current.getStats());
    setInput(value);
  }

  function next() {
    if (!comparison.isComplete || completedAt !== null || !question) return;
    setSpeed(tracker.current.getStats());
    if (index === set.questions.length - 1) setCompletedAt(Date.now());
    else {
      setIndex(index + 1);
      setInput("");
      maximum.current = 0;
    }
  }
  return { index, input, question, comparison, speed, completedAt, updateInput, next };
}
