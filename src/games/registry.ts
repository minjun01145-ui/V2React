import { defineGame, type GameDefinition } from "../game-engine/contracts/gameDefinition.ts";

const definitions = [
  defineGame({
    id: "ai-tutor",
    title: "AI 문답",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    requiresStoredSet: true,
    preloadPlayerProgress: true,
    settings: [{
      kind: "select",
      key: "direction",
      label: "문제 방향",
      defaultValue: "source-to-meaning",
      options: [
        { value: "source-to-meaning", label: "영어 → 한국어 (해석·뜻)" },
        { value: "meaning-to-source", label: "한국어 → 영어 (영작·단어)" },
      ],
    }],
    loadStudent: () => import("./ai-tutor/AiTutorStudentGame.tsx"),
    loadTeacher: () => import("./ai-tutor/AiTutorTeacherGame.tsx"),
  }),
  defineGame({
    id: "pokemon-catch",
    title: "포켓몬 잡기",
    timing: "timed",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    requiresStoredSet: true,
    preloadPlayerProgress: true,
    prepareStudent: async (context) => {
      const preparation = await import("./pokemon-catch/prepareStudent.ts");
      return preparation.default(context);
    },
    minimumSetItemCountByType: { vocabulary: 4, "reading-chunks": 1 },
    loadStudent: () => import("./pokemon-catch/PokemonCatchStudentGame.tsx"),
    loadTeacher: () => import("./pokemon-catch/PokemonCatchTeacherGame.tsx"),
  }),
  defineGame({
    id: "sentence-builder",
    title: "문장 만들기",
    supportedSetTypes: ["reading-chunks"],
    preloadPlayerProgress: true,
    loadStudent: () => import("./sentence-builder/SentenceBuilderStudentGame.tsx"),
    loadTeacher: () => import("./sentence-builder/SentenceBuilderTeacherGame.tsx"),
  }),
  defineGame({
    id: "simple-quiz",
    title: "심플퀴즈",
    supportedSetTypes: ["vocabulary"],
    minimumSetItemCount: 5,
    preloadPlayerProgress: true,
    settings: [{
      kind: "select",
      key: "choice-count",
      label: "선택지 수",
      defaultValue: "4",
      options: [2, 3, 4, 5].map((count) => ({ value: String(count), label: `${count}지선다` })),
    }],
    loadStudent: () => import("./simple-quiz/SimpleQuizStudentModule.tsx"),
    loadTeacher: () => import("./simple-quiz/SimpleQuizTeacherModule.tsx"),
  }),
  defineGame({
    id: "typing",
    title: "타자게임",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    preloadPlayerProgress: true,
    settings: [
      {
        kind: "select",
        key: "typing-target",
        label: "입력할 쪽",
        defaultValue: "source",
        options: [
          { value: "source", label: "왼쪽 (단어·문장)" },
          { value: "meaning", label: "오른쪽 (뜻)" },
        ],
      },
      {
        kind: "select",
        key: "ignore-case",
        label: "영문 대소문자",
        defaultValue: "no",
        options: [
          { value: "no", label: "구분" },
          { value: "yes", label: "무시" },
        ],
      },
      {
        kind: "select",
        key: "ignore-punctuation",
        label: "특수문자",
        defaultValue: "no",
        options: [
          { value: "no", label: "입력" },
          { value: "yes", label: "생략 가능" },
        ],
      },
    ],
    loadStudent: () => import("./typing/TypingStudentGame.tsx"),
    loadTeacher: () => import("./typing/TypingTeacherGame.tsx"),
  }),
  defineGame({
    id: "matching",
    title: "짝맞추기(일부카드)",
    supportedSetTypes: ["vocabulary"],
    minimumSetItemCount: 6,
    preloadPlayerProgress: true,
    loadStudent: () => import("./matching/MatchingStudentModule.tsx"),
    loadTeacher: () => import("./matching/MatchingTeacherModule.tsx"),
  }),
  defineGame({
    id: "matching-all",
    title: "짝맞추기(모든카드)",
    supportedSetTypes: ["vocabulary"],
    minimumSetItemCount: 4,
    preloadPlayerProgress: true,
    loadStudent: () => import("./matching-all/MatchingAllStudentModule.tsx"),
    loadTeacher: () => import("./matching-all/MatchingAllTeacherModule.tsx"),
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
