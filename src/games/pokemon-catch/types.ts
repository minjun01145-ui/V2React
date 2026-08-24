import type { LearningSetQuestionSource } from "../../learning-sets/multipleChoiceTypes.ts";
import type { MultipleChoiceQuestionSet } from "../../game-engine/question-engine/multiple-choice/types.ts";

export interface PokemonEncounter {
  readonly id: number;
  readonly name: string;
  readonly spriteUrl: string;
  readonly shinySpriteUrl: string | null;
  readonly cryUrl: string | null;
  readonly captureRate: number;
  readonly baseExperience: number;
}

export interface CapturedPokemon extends PokemonEncounter {
  readonly captureId: string;
  readonly caughtAtMs: number;
  readonly score: number;
}

export type PokemonCatchQuestionSet = MultipleChoiceQuestionSet<LearningSetQuestionSource>;
export type EncounterPhase = "loading" | "ready" | "throwing" | "caught" | "escaped" | "error";

