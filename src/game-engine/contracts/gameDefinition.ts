import type { ComponentType } from "react";
import type { ActiveGameSession, Player } from "../../multiplayer/types.ts";

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

export interface GameDefinition {
  readonly id: string;
  readonly title: string;
  readonly supportedSetTypes: readonly string[];
  readonly timing: GameTiming;
  readonly minimumSetItemCount: number;
  readonly loadStudent: () => Promise<{ default: StudentGameModuleComponent }>;
  readonly loadTeacher: () => Promise<{ default: TeacherGameModuleComponent }>;
}

export type GameDefinitionInput = Omit<GameDefinition, "timing" | "minimumSetItemCount"> & {
  readonly timing?: GameTiming;
  readonly minimumSetItemCount?: number;
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

  return Object.freeze({
    ...definition,
    title: definition.title.trim(),
    supportedSetTypes: Object.freeze([...new Set(definition.supportedSetTypes)]),
    timing: definition.timing ?? "timed",
    minimumSetItemCount,
  });
}
