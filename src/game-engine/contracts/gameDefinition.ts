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

export interface GameDefinition {
  readonly id: string;
  readonly title: string;
  readonly supportedSetTypes: readonly string[];
  readonly loadStudent: () => Promise<{ default: StudentGameModuleComponent }>;
  readonly loadTeacher: () => Promise<{ default: TeacherGameModuleComponent }>;
}

const GAME_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function defineGame(definition: GameDefinition): Readonly<GameDefinition> {
  if (!GAME_ID_PATTERN.test(definition.id)) {
    throw new Error(`Invalid game id: ${definition.id}`);
  }
  if (!definition.title.trim()) {
    throw new Error(`Game ${definition.id} requires a title.`);
  }
  if (typeof definition.loadStudent !== "function" || typeof definition.loadTeacher !== "function") {
    throw new Error(`Game ${definition.id} requires role-specific lazy loaders.`);
  }

  return Object.freeze({
    ...definition,
    title: definition.title.trim(),
    supportedSetTypes: Object.freeze([...new Set(definition.supportedSetTypes)]),
  });
}
