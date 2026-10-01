
import { defineGame, type GameDefinition } from "../game-engine/contracts/gameDefinition.ts";

const definitions = [
  defineGame({
    id: "free-response",
    title: "답안 제출",
    category: "quiz",
    summary: "질문에 자유롭게 답을 써서 제출합니다",
    supportedSetTypes: [],
    handlesOwnTimedBoundary: true,
    loadStudent: () => import("./free-response/FreeResponseStudentGame.tsx"),
    loadTeacher: () => import("./free-response/FreeResponseTeacherGame.tsx"),
  }),
  defineGame({
    id: "ai-tutor",
    title: "AI 문답",
    category: "quiz",
    summary: "AI가 문제를 내고 학생 답을 채점합니다",
    supportedSetTypes: ["vocabulary", "reading-chunks", "student-questions"],
    requiresStoredSet: true,
    preloadPlayerProgress: true,
    supportsFiniteQuizQuestions: true,
    presentQuizQuestion: (item, config) => config.direction === "meaning-to-source"
      ? { prompt: item.meaning, answer: item.sourceText.replaceAll("/", " ") }
      : { prompt: item.sourceText.replaceAll("/", " "), answer: item.meaning },
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
    solo: {
      supported: true,
      rulesVersion: "ai-tutor-v1",
      leaderboardConfigKeys: ["direction", "timedGameMode"],
      loadStudent: () => import("./ai-tutor/SoloAiTutorStudentModule.tsx"),
    },
    loadStudent: () => import("./ai-tutor/AiTutorStudentGame.tsx"),
    loadTeacher: () => import("./ai-tutor/AiTutorTeacherGame.tsx"),
  }),
  defineGame({
    id: "pokemon-catch",
    title: "포켓몬 잡기",
    category: "action",
    summary: "문제를 맞히면 포켓몬을 잡을 기회를 얻습니다",
    timing: "timed",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    requiresStoredSet: true,
    preloadPlayerProgress: true,
    prepareStudent: async (context) => {
      const preparation = await import("./pokemon-catch/prepareStudent.ts");
      return preparation.default(context);
    },
    minimumSetItemCountByType: { vocabulary: 4, "reading-chunks": 1 },
    solo: {
      supported: true,
      rulesVersion: "pokemon-catch-v1",
      leaderboardConfigKeys: ["timedGameMode"],
      loadStudent: () => import("./pokemon-catch/SoloPokemonCatchStudentModule.tsx"),
    },
    loadStudent: () => import("./pokemon-catch/PokemonCatchStudentGame.tsx"),
    loadTeacher: () => import("./pokemon-catch/PokemonCatchTeacherGame.tsx"),
  }),
  defineGame({
    id: "sentence-builder",
    title: "문장 조립",
    category: "sentence",
    summary: "끊어진 조각을 순서대로 맞춰 문장을 완성합니다",
    supportedSetTypes: ["reading-chunks"],
    preloadPlayerProgress: true,
    supportsFiniteQuizQuestions: true,
    presentQuizQuestion: (item) => ({ prompt: item.meaning, answer: item.sourceText.replaceAll("/", " ") }),
    solo: {
      supported: true,
      rulesVersion: "sentence-builder-v1",
      leaderboardConfigKeys: ["timedGameMode"],
      loadStudent: () => import("./sentence-builder/SoloSentenceBuilderStudentModule.tsx"),
    },
    loadStudent: () => import("./sentence-builder/SentenceBuilderStudentGame.tsx"),
    loadTeacher: () => import("./sentence-builder/SentenceBuilderTeacherGame.tsx"),
  }),
  defineGame({
    id: "cooperative-sentence-builder",
    title: "짝꿍 문장 조립",
    category: "sentence",
    summary: "두 명이 조각을 나눠 갖고 함께 문장을 완성합니다",
    supportedSetTypes: ["reading-chunks"],
    requiresStoredSet: true,
    handlesOwnTimedBoundary: true,
    loadStudent: () => import("./cooperative-sentence-builder/CooperativeSentenceStudentGame.tsx"),
    loadTeacher: () => import("./cooperative-sentence-builder/CooperativeSentenceTeacherGame.tsx"),
  }),
  defineGame({
    id: "one-on-one-battle",
    title: "1:1 대결",
    category: "quiz",
    summary: "두 명씩 짝지어 해석·영작 문제로 겨룹니다",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    requiresStoredSet: true,
    handlesOwnTimedBoundary: true,
    settings: [
      {
        kind: "select",
        key: "battle-direction",
        label: "출제 방향",
        defaultValue: "free",
        options: [
          { value: "free", label: "영작·해석 모두 (학생 선택)" },
          { value: "translation-only", label: "해석 문제만 (영어 → 한글)" },
          { value: "composition-only", label: "영작 문제만 (한글 → 영어)" },
        ],
      },
      {
        kind: "select",
        key: "battle-answer-seconds",
        label: "문제 푸는 시간",
        defaultValue: "20",
        options: [10, 20, 30, 40].map((seconds) => ({
          value: String(seconds),
          label: `${seconds}초`,
        })),
      },
    ],
    loadStudent: () => import("./one-on-one-battle/OneOnOneBattleStudentGame.tsx"),
    loadTeacher: () => import("./one-on-one-battle/OneOnOneBattleTeacherGame.tsx"),
  }),
  defineGame({
    id: "word-uno",
    title: "단어 우노",
    category: "card",
    summary: "단어 카드로 우노를 합니다",
    timing: "timed",
    fixedTimedMode: "3-minutes",
    supportedSetTypes: ["form-changes"],
    requiresStoredSet: true,
    handlesOwnTimedBoundary: true,
    settings: [{
      kind: "select",
      key: "word-uno-colors",
      label: "카드 색상",
      defaultValue: "on",
      options: [
        { value: "on", label: "켜기" },
        { value: "off", label: "끄기" },
      ],
    }],
    loadStudent: () => import("./word-uno/WordUnoStudentGame.tsx"),
    loadTeacher: () => import("./word-uno/WordUnoTeacherGame.tsx"),
  }),
  defineGame({
    id: "simple-quiz",
    title: "객관식 퀴즈",
    category: "quiz",
    summary: "뜻을 보고 알맞은 단어를 고릅니다",
    supportedSetTypes: ["vocabulary"],
    minimumSetItemCount: 5,
    preloadPlayerProgress: true,
    supportsFiniteQuizQuestions: true,
    presentQuizQuestion: (item) => ({ prompt: item.meaning, answer: item.sourceText }),
    settings: [{
      kind: "select",
      key: "choice-count",
      label: "선택지 수",
      defaultValue: "4",
      options: [2, 3, 4, 5].map((count) => ({ value: String(count), label: `${count}지선다` })),
    }],
    solo: {
      supported: true,
      rulesVersion: "simple-quiz-v2",
      leaderboardConfigKeys: ["choice-count", "timedGameMode"],
      loadStudent: () => import("./simple-quiz/SoloSimpleQuizStudentModule.tsx"),
    },
    loadStudent: () => import("./simple-quiz/SimpleQuizStudentModule.tsx"),
    loadTeacher: () => import("./simple-quiz/SimpleQuizTeacherModule.tsx"),
  }),
  defineGame({
    id: "typing",
    title: "문장 타자",
    category: "typing",
    summary: "단어와 문장을 빠르고 정확하게 입력합니다",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    preloadPlayerProgress: true,
    supportsFiniteQuizQuestions: true,
    presentQuizQuestion: (item, config) => config["typing-target"] === "meaning"
      ? { prompt: item.sourceText.replaceAll("/", " "), answer: item.meaning }
      : { prompt: item.meaning, answer: item.sourceText.replaceAll("/", " ") },
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
    id: "acid-rain",
    title: "산성비",
    category: "typing",
    summary: "떨어지는 단어를 바닥에 닿기 전에 입력합니다",
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    requiresStoredSet: true,
    loadStudent: () => import("./typing/AcidRainStudentGame.tsx"),
    loadTeacher: () => import("./typing/AcidRainTeacherGame.tsx"),
  }),
  defineGame({
    id: "matching",
    title: "짝 맞추기",
    category: "card",
    summary: "카드를 뒤집어 단어와 뜻의 짝을 찾습니다",
    supportedSetTypes: ["vocabulary"],
    minimumSetItemCount: 6,
    preloadPlayerProgress: true,
    loadStudent: () => import("./matching/MatchingStudentModule.tsx"),
    loadTeacher: () => import("./matching/MatchingTeacherModule.tsx"),
  }),
  defineGame({
    id: "matching-all",
    title: "짝 맞추기 · 전체",
    category: "card",
    summary: "모든 카드를 한 번에 펼쳐 놓고 짝을 찾습니다",
    supportedSetTypes: ["vocabulary"],
    minimumSetItemCount: 4,
    preloadPlayerProgress: true,
    loadStudent: () => import("./matching-all/MatchingAllStudentModule.tsx"),
    loadTeacher: () => import("./matching-all/MatchingAllTeacherModule.tsx"),
  }),
  defineGame({
    id: "meaning-dash",
    title: "뜻 달리기 (실험)",
    category: "action",
    summary: "달리면서 알맞은 뜻 쪽으로 이동합니다",
    supportedSetTypes: ["vocabulary"],
    requiresStoredSet: true,
    minimumSetItemCount: 3,
    loadStudent: () => import("./meaning-dash/MeaningDashStudentGame.tsx"),
    loadTeacher: () => import("./meaning-dash/MeaningDashTeacherGame.tsx"),
  }),
  defineGame({
    id: "chunk-line-up",
    title: "끊어읽기 줄 세우기",
    category: "action",
    summary: "끊어읽기 조각을 순서대로 모아 문장을 만듭니다",
    timing: "timed",
    fixedTimedMode: "3-minutes",
    handlesOwnTimedBoundary: true,
    supportedSetTypes: ["reading-chunks"],
    requiresStoredSet: true,
    loadStudent: () => import("./chunk-line-up/ChunkLineUpStudentGame.tsx"),
    loadTeacher: () => import("./chunk-line-up/ChunkLineUpTeacherGame.tsx"),
  }),
  defineGame({
    id: "chunk-jump-race",
    title: "끊어읽기 점프",
    category: "action",
    summary: "다음 조각으로 점프하며 문장을 끝까지 읽습니다",
    timing: "timed",
    fixedTimedMode: "3-minutes",
    handlesOwnTimedBoundary: true,
    supportedSetTypes: ["reading-chunks"],
    requiresStoredSet: true,
    settings: [{
      kind: "select",
      key: "chunk-jump-meaning",
      label: "문장 뜻 표시",
      defaultValue: "off",
      options: [
        { value: "off", label: "끄기" },
        { value: "on", label: "켜기" },
      ],
    }],
    loadStudent: () => import("./chunk-jump-race/ChunkJumpRaceStudentGame.tsx"),
    loadTeacher: () => import("./chunk-jump-race/ChunkJumpRaceTeacherGame.tsx"),
  }),
  defineGame({
    id: "placeholder",
    title: "개발용 빈 게임",
    category: "quiz",
    summary: "개발 확인용 빈 게임입니다",
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
