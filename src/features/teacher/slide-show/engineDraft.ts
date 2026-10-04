import { minimumSetItemCountForType, type GameDefinition } from "../../../game-engine/contracts/gameDefinition.ts";
import { getGame, listGames } from "../../../games/registry.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import type { SlideEngine, SlideEngineCustomItem, SlideEngineRound, SlideFrame } from "../../../slide-show/types.ts";

/** Games that can run as a timed question engine inside a slide, plus free response. */
export const SLIDE_ENGINE_GAMES: readonly GameDefinition[] = [
  ...listGames().filter((game) => game.supportedSetTypes.length > 0 && game.fixedTimedMode === null),
  getGame("free-response"),
];

export const DEFAULT_ENGINE_FRAME: SlideFrame = { x: 140, y: 90, width: 1000, height: 540 };

function defaultConfig(game: GameDefinition): Readonly<Record<string, string>> {
  return Object.fromEntries(game.settings.map((setting) => [setting.key, setting.defaultValue]));
}

export function newCustomItem(): SlideEngineCustomItem {
  return { id: crypto.randomUUID(), sourceText: "", meaning: "" };
}

export function engineRoundForGame(gameId: string, sets: readonly LearningSetSummary[]): SlideEngineRound {
  const game = getGame(gameId);
  const firstSet = sets.find((set) => game.supportedSetTypes.includes(set.type));
  return {
    gameId: game.id,
    source: game.id === "free-response" ? { kind: "free-response", prompt: "" } : { kind: "stored-set", setId: firstSet?.id ?? null },
    durationSeconds: 60,
    gameConfig: defaultConfig(game),
  };
}

export function newSlideEngine(sets: readonly LearningSetSummary[]): SlideEngine {
  return { frame: DEFAULT_ENGINE_FRAME, round: engineRoundForGame("simple-quiz", sets) };
}

export function compatibleSets(round: SlideEngineRound, sets: readonly LearningSetSummary[]): readonly LearningSetSummary[] {
  const game = getGame(round.gameId);
  return sets.filter((set) => game.supportedSetTypes.includes(set.type));
}

/** Checks that need the teacher's learning sets, which the domain validation cannot see. */
export function engineSetIssue(round: SlideEngineRound, sets: readonly LearningSetSummary[]): string | null {
  const game = getGame(round.gameId);
  const source = round.source;
  if (source.kind === "stored-set") {
    const set = sets.find((item) => item.id === source.setId);
    if (game.requiresStoredSet && !set) return "학습 세트를 선택해 주세요.";
    if (set && set.itemCount < minimumSetItemCountForType(game, set.type)) return `${game.title}에 필요한 문항 수가 부족합니다.`;
  } else if (source.kind === "custom") {
    if (!game.supportsFiniteQuizQuestions || !game.supportedSetTypes.includes(source.setType)) return "이 엔진은 선택한 직접 출제 형식을 지원하지 않습니다.";
    if (source.items.length < minimumSetItemCountForType(game, source.setType)) return `${game.title}에 필요한 문항 수가 부족합니다.`;
  }
  return null;
}
