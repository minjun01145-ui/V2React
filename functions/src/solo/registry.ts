import { HttpsError } from "firebase-functions/v2/https";
import { SIMPLE_QUIZ_LEADERBOARD_CONFIG_KEYS, SIMPLE_QUIZ_RULES_VERSION } from "./model.js";

const TIMED_GAME_MODES = new Set(["unlimited", "3-minutes", "5-minutes"]);

const soloGames = {
  "simple-quiz": {
    rulesVersion: SIMPLE_QUIZ_RULES_VERSION,
    leaderboardConfigKeys: SIMPLE_QUIZ_LEADERBOARD_CONFIG_KEYS,
    supportedSetTypes: ["vocabulary"],
    minimumItems: { vocabulary: 5 },
    settings: ["choice-count", "timedGameMode"],
  },
  "ai-tutor": {
    rulesVersion: "ai-tutor-v1",
    leaderboardConfigKeys: ["direction", "timedGameMode"],
    supportedSetTypes: ["vocabulary", "reading-chunks", "student-questions"],
    minimumItems: { vocabulary: 1, "reading-chunks": 1, "student-questions": 1 },
    settings: ["direction", "timedGameMode"],
  },
  "pokemon-catch": {
    rulesVersion: "pokemon-catch-v1",
    leaderboardConfigKeys: ["timedGameMode"],
    supportedSetTypes: ["vocabulary", "reading-chunks"],
    minimumItems: { vocabulary: 4, "reading-chunks": 1 },
    settings: ["timedGameMode"],
  },
  "sentence-builder": {
    rulesVersion: "sentence-builder-v1",
    leaderboardConfigKeys: ["timedGameMode"],
    supportedSetTypes: ["reading-chunks"],
    minimumItems: { "reading-chunks": 1 },
    settings: ["timedGameMode"],
  },
} as const;

export type SoloGameId = keyof typeof soloGames;
export type SoloGameRules = (typeof soloGames)[SoloGameId];

export function isSoloGameId(value: unknown): value is SoloGameId {
  return typeof value === "string" && Object.hasOwn(soloGames, value);
}

export function soloGameRules(gameId: SoloGameId): SoloGameRules {
  return soloGames[gameId];
}

export function parseSoloGameConfig(gameId: SoloGameId, setId: string, value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpsError("invalid-argument", "Solo 게임 설정이 올바르지 않습니다.");
  }
  const raw = value as Record<string, unknown>;
  const rules = soloGameRules(gameId);
  if (raw.setId !== setId || Object.keys(raw).some((key) => key !== "setId" && !(rules.settings as readonly string[]).includes(key))) {
    throw new HttpsError("invalid-argument", "Solo 게임 설정이 올바르지 않습니다.");
  }

  if (gameId === "simple-quiz" && (typeof raw["choice-count"] !== "string" || !["2", "3", "4", "5"].includes(raw["choice-count"]))) {
    throw new HttpsError("invalid-argument", "Solo 게임 설정이 올바르지 않습니다.");
  }
  if (gameId === "ai-tutor" && raw.direction !== "source-to-meaning" && raw.direction !== "meaning-to-source") {
    throw new HttpsError("invalid-argument", "Solo 게임 설정이 올바르지 않습니다.");
  }
  if (typeof raw.timedGameMode !== "string" || !TIMED_GAME_MODES.has(raw.timedGameMode)) {
    throw new HttpsError("invalid-argument", "Solo 게임 시간 설정이 올바르지 않습니다.");
  }

  return Object.freeze(Object.fromEntries([
    ["setId", setId],
    ...(gameId === "simple-quiz" ? [["choice-count", raw["choice-count"] as string] as const] : []),
    ...(gameId === "ai-tutor" ? [["direction", raw.direction as string] as const] : []),
    ["timedGameMode", raw.timedGameMode],
  ]));
}
