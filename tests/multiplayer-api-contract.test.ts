import type { GameSession, JoinSessionInput, Player, StartSessionOptions } from "../src/multiplayer/types.ts";

type Assert<T extends true> = T;
type PublicMultiplayerKeys =
  | keyof GameSession
  | keyof JoinSessionInput
  | keyof Player
  | keyof StartSessionOptions;

type SessionDoesNotExposeRawPersistence = Assert<"sessionData" extends keyof GameSession ? false : true>;
type PublicApiDoesNotAcceptArbitraryFieldDeletion = Assert<"fieldsToDelete" extends PublicMultiplayerKeys ? false : true>;

const sessionBoundary: SessionDoesNotExposeRawPersistence = true;
const mutationBoundary: PublicApiDoesNotAcceptArbitraryFieldDeletion = true;

if (!sessionBoundary || !mutationBoundary) throw new Error("multiplayer API persistence boundary is invalid");

console.log("multiplayer API boundary tests passed");
