import { lazy, Suspense, useMemo, type LazyExoticComponent } from "react";
import type { SoloGameModuleComponent } from "../contracts.ts";
import type { SoloRun } from "../contracts.ts";
import type { RuntimeLearningSet } from "../../learning-sets/types.ts";
import { getGame } from "../../games/registry.ts";
import GameErrorBoundary from "../../shared/errors/GameErrorBoundary.tsx";
import StatusPanel from "../../shared/StatusPanel.tsx";

const moduleCache = new Map<string, LazyExoticComponent<SoloGameModuleComponent>>();

function componentFor(gameId: string): LazyExoticComponent<SoloGameModuleComponent> | null {
  const game = getGame(gameId);
  if (!game.solo.supported) return null;
  const cached = moduleCache.get(gameId);
  if (cached) return cached;
  const component = lazy(game.solo.loadStudent);
  moduleCache.set(gameId, component);
  return component;
}

export default function SoloGameHost({ run, set, onFinish, onExit }: {
  readonly run: SoloRun;
  readonly set: RuntimeLearningSet;
  readonly onFinish: () => Promise<void>;
  readonly onExit: () => Promise<void>;
}) {
  const game = getGame(run.gameId);
  const Game = useMemo(() => componentFor(run.gameId), [run.gameId]);
  if (!game.solo.supported || !Game) return <StatusPanel title="지원하지 않는 Solo 게임" tone="error">{game.title}은(는) 아직 혼자하기를 지원하지 않습니다.</StatusPanel>;
  return <GameErrorBoundary resetKey={`${run.runId}:${run.gameId}`}>
    <Suspense fallback={<StatusPanel title="게임 준비 중" tone="waiting">Solo 게임 화면을 불러오고 있습니다.</StatusPanel>}>
      <Game run={run} set={set} onFinish={onFinish} onExit={onExit} />
    </Suspense>
  </GameErrorBoundary>;
}
