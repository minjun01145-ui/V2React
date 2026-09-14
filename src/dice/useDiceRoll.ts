import { useCallback, useRef, useState } from "react";
import { createDiceResults, DICE_ROLL_ANIMATION_MS, type DiceCount, type DiceRollState } from "./model.ts";

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

export function useDiceRoll(initialCount: DiceCount = 1): {
  readonly state: DiceRollState;
  readonly roll: (count: DiceCount) => Promise<readonly number[]>;
} {
  const [state, setState] = useState<DiceRollState>({ phase: "idle", diceCount: initialCount, results: [] });
  const activeRoll = useRef(0);

  const roll = useCallback(async (count: DiceCount): Promise<readonly number[]> => {
    const rollId = activeRoll.current + 1;
    activeRoll.current = rollId;
    setState({ phase: "rolling", diceCount: count, results: [] });
    await wait(DICE_ROLL_ANIMATION_MS);
    const results = createDiceResults(count);
    if (activeRoll.current === rollId) setState({ phase: "result", diceCount: count, results });
    return results;
  }, []);

  return { state, roll };
}
