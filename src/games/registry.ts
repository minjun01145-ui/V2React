import { defineGame, type GameDefinition } from "../game-engine/contracts/gameDefinition.ts";

const definitions = [
  defineGame({
    id: "pokemon-catch",
    title: "포켓몬 잡기",
    supportedSetTypes: ["vocabulary"],
    loadStudent: () => import("./pokemon-catch/PokemonCatchStudentGame.tsx"),
    loadTeacher: () => import("./pokemon-catch/PokemonCatchTeacherGame.tsx"),
  }),
  defineGame({
    id: "sentence-builder",
    title: "문장 만들기",
    supportedSetTypes: ["reading-chunks"],
    loadStudent: () => import("./sentence-builder/SentenceBuilderStudentGame.tsx"),
    loadTeacher: () => import("./sentence-builder/SentenceBuilderTeacherGame.tsx"),
  }),
  defineGame({
    id: "matching",
    title: "짝맞추기",
    supportedSetTypes: ["vocabulary"],
    loadStudent: () => import("./matching/MatchingStudentModule.tsx"),
    loadTeacher: () => import("./matching/MatchingTeacherModule.tsx"),
  }),
  defineGame({
    id: "placeholder",
    title: "개발용 빈 게임",
    supportedSetTypes: [],
    loadStudent: () => import("./placeholder/PlaceholderStudentGame.tsx"),
    loadTeacher: () => import("./placeholder/PlaceholderTeacherGame.tsx"),
  }),
] satisfies readonly GameDefinition[];

const registry = new Map(definitions.map((game) => [game.id, game] as const));
const fallbackGame: GameDefinition = (() => {
  const game = registry.get("placeholder");
  if (!game) throw new Error("Placeholder game must be registered.");
  return game;
})();

export function getGame(gameId: string): GameDefinition {
  return registry.get(gameId) ?? fallbackGame;
}

export function findGameForSetType(setType: string): GameDefinition | null {
  return definitions.find((game) => game.supportedSetTypes.includes(setType)) ?? null;
}

export function listGames(): readonly GameDefinition[] {
  return definitions;
}
