import type { ActiveGameSession } from "../../multiplayer/types.ts";
import { TYPING_TARGET, type TypingComparisonOptions, type TypingTarget } from "./types.ts";

export interface TypingGameOptions extends TypingComparisonOptions {
  readonly target: TypingTarget;
  readonly ignoreCase: boolean;
  readonly ignorePunctuation: boolean;
}

export const DEFAULT_TYPING_OPTIONS: TypingGameOptions = Object.freeze({
  target: TYPING_TARGET.SOURCE,
  ignoreCase: false,
  ignorePunctuation: false,
});

function enabled(value: unknown): boolean {
  return value === "yes";
}

export function parseTypingGameOptions(config: Readonly<Record<string, unknown>> | null): TypingGameOptions {
  return {
    target: config?.["typing-target"] === TYPING_TARGET.MEANING ? TYPING_TARGET.MEANING : TYPING_TARGET.SOURCE,
    ignoreCase: enabled(config?.["ignore-case"]),
    ignorePunctuation: enabled(config?.["ignore-punctuation"]),
  };
}

export function typingGameOptions(session: ActiveGameSession): TypingGameOptions {
  return parseTypingGameOptions(session.gameConfig);
}
