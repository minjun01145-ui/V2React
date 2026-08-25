import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";
import type { MultipleChoiceQuestionSet } from "../../game-engine/question-engine/multiple-choice/types.ts";

export interface PokemonEncounter {
  readonly id: number;
  readonly name: string;
  readonly spriteUrl: string;
  readonly fallbackSpriteUrl: string | null;
  readonly shinySpriteUrl: string | null;
  readonly cryUrl: string | null;
  readonly captureRate: number;
}

export type PokemonCatchQuestionSet = MultipleChoiceQuestionSet<LearningSetQuestionSource>;
export type EncounterLoadStatus = "loading" | "ready" | "error";
export type EncounterActionPhase = "ready" | "throwing" | "failed" | "caught" | "escaped";
export type EncounterPhase = "loading" | EncounterActionPhase | "error";
