import type { ComponentType } from "react";
import type { RuntimeLearningSet } from "../learning-sets/types.ts";
import type { TenantId } from "../tenant/scope.ts";

export type SoloRunStatus = "active" | "completed" | "abandoned";

export interface SoloFinalResult {
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
  readonly combo: number;
  readonly displayLabel: string;
  readonly completedAtMs: number;
}

export interface SoloRun {
  readonly runId: string;
  readonly ownerUid: string;
  readonly tenantId: TenantId;
  readonly gameId: string;
  readonly setId: string;
  readonly setFingerprint: string;
  readonly gameConfig: Readonly<Record<string, string>>;
  readonly rulesVersion: string;
  readonly leaderboardScopeId: string;
  readonly status: SoloRunStatus;
  readonly startedAtMs: number;
  readonly completedAtMs: number | null;
  readonly finalResult: SoloFinalResult | null;
}

export interface SoloBestRecord {
  readonly score: number;
  readonly correctCount: number;
  readonly attemptCount: number;
  readonly displayLabel: string;
  readonly completedAtMs: number;
}

export interface SoloLeaderboardRecord extends SoloBestRecord {
  readonly rank: number;
}

export interface SoloFinishResult {
  readonly result: SoloFinalResult;
  readonly best: SoloBestRecord;
  readonly leaderboard: readonly SoloLeaderboardRecord[];
}

export interface SoloGameModuleProps {
  readonly run: SoloRun;
  readonly set: RuntimeLearningSet;
  readonly onFinish: () => Promise<void>;
  readonly onExit: () => Promise<void>;
}

export type SoloGameModuleComponent = ComponentType<SoloGameModuleProps>;

export type SoloCapability =
  | { readonly supported: false }
  | {
      readonly supported: true;
      readonly rulesVersion: string;
      readonly leaderboardConfigKeys: readonly string[];
      readonly loadStudent: () => Promise<{ default: SoloGameModuleComponent }>;
    };
