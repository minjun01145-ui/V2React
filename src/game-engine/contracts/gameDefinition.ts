import type { ComponentType } from "react";
import type { ActiveGameSession, GameSession, Player } from "../../multiplayer/types.ts";

export type TeacherGameModuleProps = {
  readonly role: "teacher";
  readonly roomId: string;
  readonly session: ActiveGameSession;
};

export type StudentGameModuleProps = {
  readonly role: "student";
  readonly roomId: string;
  readonly session: ActiveGameSession;
  readonly player: Player;
};

export type TeacherGameModuleComponent = ComponentType<TeacherGameModuleProps>;
export type StudentGameModuleComponent = ComponentType<StudentGameModuleProps>;

export type GameTiming = "timed" | "untimed";

export interface StudentGamePreparationContext {
  readonly session: GameSession;
  readonly player: Player;
}

export interface GameSelectSetting {
  readonly kind: "select";
  readonly key: string;
  readonly label: string;
  readonly defaultValue: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
}

export interface GameDefinition {
  readonly id: string;
  readonly title: string;
  readonly supportedSetTypes: readonly string[];
  readonly timing: GameTiming;
  readonly minimumSetItemCount: number;
  readonly minimumSetItemCountByType: Readonly<Record<string, number>>;
  readonly requiresStoredSet: boolean;
  readonly settings: readonly GameSelectSetting[];
  readonly preloadPlayerProgress: boolean;
  readonly prepareStudent?: (context: StudentGamePreparationContext) => Promise<(() => void) | void>;
  readonly loadStudent: () => Promise<{ default: StudentGameModuleComponent }>;
  readonly loadTeacher: () => Promise<{ default: TeacherGameModuleComponent }>;
}

export type GameDefinitionInput = Omit<GameDefinition, "timing" | "minimumSetItemCount" | "minimumSetItemCountByType" | "requiresStoredSet" | "settings" | "preloadPlayerProgress"> & {
  readonly timing?: GameTiming;
  readonly minimumSetItemCount?: number;
  readonly minimumSetItemCountByType?: Readonly<Record<string, number>>;
  readonly requiresStoredSet?: boolean;
  readonly settings?: readonly GameSelectSetting[];
  readonly preloadPlayerProgress?: boolean;
};

const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function defineGame(definition: GameDefinitionInput): Readonly<GameDefinition> {
  if (!GAME_ID_PATTERN.test(definition.id)) {
    throw new Error(`Invalid game id: ${definition.id}`);
  }
  if (!definition.title.trim()) {
    throw new Error(`Game ${definition.id} requires a title.`);
  }
  if (typeof definition.loadStudent !== "function" || typeof definition.loadTeacher !== "function") {
    throw new Error(`Game ${definition.id} requires role-specific lazy loaders.`);
  }
  const minimumSetItemCount = definition.minimumSetItemCount ?? 1;
  if (!Number.isInteger(minimumSetItemCount) || minimumSetItemCount < 0) {
    throw new Error(`Game ${definition.id} requires a non-negative minimum set item count.`);
  }
  const minimumSetItemCountByType = definition.minimumSetItemCountByType ?? {};
  for (const [setType, count] of Object.entries(minimumSetItemCountByType)) {
    if (!definition.supportedSetTypes.includes(setType) || !Number.isInteger(count) || count < 0) {
      throw new Error(`Game ${definition.id} has an invalid minimum item count for set type ${setType}.`);
    }
  }
  const settings = definition.settings ?? [];
  const settingKeys = new Set<string>();
  for (const setting of settings) {
    if (!GAME_ID_PATTERN.test(setting.key) || settingKeys.has(setting.key)) throw new Error(`Game ${definition.id} has an invalid or duplicate setting key: ${setting.key}`);
    if (!setting.options.some((option) => option.value === setting.defaultValue)) throw new Error(`Game ${definition.id} setting ${setting.key} has an invalid default value.`);
    settingKeys.add(setting.key);
  }

  return Object.freeze({
    ...definition,
    title: definition.title.trim(),
    supportedSetTypes: Object.freeze([...new Set(definition.supportedSetTypes)]),
    timing: definition.timing ?? "timed",
    minimumSetItemCount,
    minimumSetItemCountByType: Object.freeze({ ...minimumSetItemCountByType }),
    requiresStoredSet: definition.requiresStoredSet ?? false,
    preloadPlayerProgress: definition.preloadPlayerProgress ?? false,
    settings: Object.freeze(settings.map((setting) => Object.freeze({ ...setting, options: Object.freeze([...setting.options]) }))),
  });
}

export function minimumSetItemCountForType(game: GameDefinition, setType: string): number {
  return game.minimumSetItemCountByType[setType] ?? game.minimumSetItemCount;
}
