import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActiveGameSession } from "../../multiplayer/types.ts";
import type { SoloGameModuleProps } from "../../solo/contracts.ts";
import { useTimedGameClock } from "../../game-engine/timed-game/useTimedGameClock.ts";
import { formatClock } from "../../game-engine/timed-game/clock.ts";
import StatusPanel from "../../shared/StatusPanel.tsx";
import Button from "../../shared/ui/Button.tsx";
import StudentPokemonCatch from "./StudentPokemonCatch.tsx";
import styles from "./PokemonCatch.module.css";

export default function SoloPokemonCatchStudentModule({ run, set, player, onFinish, onExit }: SoloGameModuleProps) {
  const clock = useTimedGameClock({ gameConfig: run.gameConfig, roundId: run.runId, startedAtMs: run.startedAtMs });
  const [finishing, setFinishing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [finishError, setFinishError] = useState("");
  const automaticFinishStartedRef = useRef(false);
  const session = useMemo<ActiveGameSession>(() => ({
    id: run.runId,
    tenantId: run.tenantId,
    roomId: run.runId,
    gameId: "pokemon-catch",
    status: "playing",
    roundId: run.runId,
    gameConfig: run.gameConfig,
    createdAtMs: run.startedAtMs,
    updatedAtMs: run.startedAtMs,
    startedAtMs: run.startedAtMs,
    expectedPlayerIds: [player.id],
  }), [player.id, run.gameConfig, run.runId, run.startedAtMs, run.tenantId]);

  const finish = useCallback(async (): Promise<void> => {
    if (finishing || exiting) return;
    setFinishing(true);
    setFinishError("");
    try { await onFinish(); }
    catch (error: unknown) {
      console.error(error);
      setFinishError(error instanceof Error ? error.message : "결과를 저장하지 못했습니다.");
      setFinishing(false);
    }
  }, [exiting, finishing, onFinish]);
  const exit = useCallback(async (): Promise<void> => {
    if (finishing || exiting) return;
    setExiting(true);
    try { await onExit(); }
    catch (error: unknown) {
      console.error(error);
      setExiting(false);
    }
  }, [exiting, finishing, onExit]);

  useEffect(() => {
    if (clock.expired && !finishing && !exiting && !automaticFinishStartedRef.current) {
      automaticFinishStartedRef.current = true;
      void finish();
    }
  }, [clock.expired, exiting, finish, finishing]);

  if (finishing) return <StatusPanel title="결과 저장 중">포켓몬 잡기 결과를 저장하고 있습니다.</StatusPanel>;
  if (exiting) return <StatusPanel title="게임 종료 중">대기실로 돌아가고 있습니다.</StatusPanel>;
  if (clock.expired) return <StatusPanel title="제한 시간 종료">
    {finishError ? <><p role="alert">{finishError}</p><Button onClick={() => void finish()} disabled={finishing}>{finishing ? "결과 저장 중…" : "결과 저장 다시 시도"}</Button><Button variant="ghost" onClick={() => void exit()} disabled={exiting}>{exiting ? "종료 중…" : "대기실로 돌아가기"}</Button></> : "포켓몬 잡기 결과를 정리하고 있습니다."}
  </StatusPanel>;

  return <div>
    <header className={styles.soloControls}>
      <span>{clock.remainingMs === null ? "혼자하기" : `남은 시간 ${formatClock(clock.remainingMs)}`}</span>
      <div>
        <Button variant="ghost" onClick={() => void exit()}>그만하기</Button>
        <Button variant="ghost" onClick={() => void finish()}>게임 마치기</Button>
      </div>
    </header>
    {finishError ? <StatusPanel title="결과 저장 오류" tone="error">{finishError}</StatusPanel> : null}
    <StudentPokemonCatch roomId={run.runId} session={session} player={player} set={set} soloRun={run} />
  </div>;
}
