import type { GameDefinition } from "../../game-engine/contracts/gameDefinition.ts";
import { DEFAULT_TIMED_GAME_MODE, isTimedGameMode } from "../../game-engine/timed-game/config.ts";

export type SoloGameConfig = Readonly<Record<string, string>>;

export function normalizeSoloGameConfig(
  game: GameDefinition,
  input: Readonly<Record<string, unknown>>,
): SoloGameConfig {
  if (!game.solo.supported) throw new Error(`${game.title}은(는) 혼자하기를 지원하지 않습니다.`);

  const setId = typeof input.setId === "string" ? input.setId.trim() : "";
  if (game.requiresStoredSet && !setId) throw new Error("저장된 학습 세트를 선택해 주세요.");

  const config: Record<string, string> = {};
  if (setId) config.setId = setId;
  for (const setting of game.settings) {
    const candidate = typeof input[setting.key] === "string" ? input[setting.key] as string : setting.defaultValue;
    if (!setting.options.some((option) => option.value === candidate)) {
      throw new Error(`${setting.label} 설정이 올바르지 않습니다.`);
    }
    config[setting.key] = candidate;
  }
  if (game.timing === "timed") {
    const timedGameMode = game.fixedTimedMode
      ?? (isTimedGameMode(input.timedGameMode) ? input.timedGameMode : DEFAULT_TIMED_GAME_MODE);
    config.timedGameMode = timedGameMode;
  }
  return Object.freeze(Object.fromEntries(Object.entries(config).sort(([left], [right]) => left.localeCompare(right))));
}

export interface SoloLeaderboardScope {
  readonly tenantId: string;
  readonly gameId: string;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: SoloGameConfig;
  readonly rulesVersion: string;
}

export function canonicalizeLeaderboardScope(
  scope: SoloLeaderboardScope,
  configKeys: readonly string[],
): string {
  const gameplayConfig = Object.fromEntries(
    [...configKeys].sort().map((key) => [key, scope.gameConfig[key] ?? ""]),
  );
  return JSON.stringify({
    tenantId: scope.tenantId,
    gameId: scope.gameId,
    setId: scope.setId,
    setFingerprint: scope.setFingerprint,
    gameConfig: gameplayConfig,
    rulesVersion: scope.rulesVersion,
  });
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
