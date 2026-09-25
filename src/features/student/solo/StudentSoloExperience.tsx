import { useCallback, useEffect, useRef, useState } from "react";
import type { Player } from "../../../multiplayer/types.ts";
import type { StudentIdentity } from "../../../auth/types.ts";
import { getLearningSet } from "../../../learning-sets/readRepository.ts";
import type { LearningSetSummary, RuntimeLearningSet } from "../../../learning-sets/types.ts";
import type { GameDefinition } from "../../../game-engine/contracts/gameDefinition.ts";
import { normalizeSoloGameConfig } from "../../../solo/domain/config.ts";
import { fingerprintLearningSet } from "../../../solo/domain/learningSetFingerprint.ts";
import { abandonSoloRun, finishSoloRun, startSoloRun } from "../../../solo/persistence/repository.ts";
import type { SoloFinishResult, SoloRun } from "../../../solo/contracts.ts";
import SoloGameHost from "../../../solo/runtime/SoloGameHost.tsx";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import SoloSetup from "./SoloSetup.tsx";
import styles from "./StudentSolo.module.css";

export default function StudentSoloExperience({ identity, player, onReturnToLobby }: {
  readonly identity: StudentIdentity;
  readonly player: Player;
  readonly onReturnToLobby: () => void;
}) {
  const [run, setRun] = useState<SoloRun | null>(null);
  const activeRun = useRef<SoloRun | null>(null);
  const [learningSet, setLearningSet] = useState<RuntimeLearningSet | null>(null);
  const [finishResult, setFinishResult] = useState<SoloFinishResult | null>(null);
  const [error, setError] = useState("");
  const finishInFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const active = activeRun.current;
      if (active?.status === "active") void abandonSoloRun(active).catch(console.error);
    };
  }, []);

  const start = async (game: GameDefinition, summary: LearningSetSummary, rawConfig: Readonly<Record<string, unknown>>): Promise<void> => {
    if (!game.solo.supported) throw new Error("선택한 게임은 혼자하기를 지원하지 않습니다.");
    const set = await getLearningSet(summary.id, `solo:${identity.uid}`);
    if (!mounted.current) return;
    if (set.itemCount < game.minimumSetItemCount || !game.supportedSetTypes.includes(set.type)) throw new Error("선택한 학습 세트가 이 게임의 조건을 충족하지 않습니다.");
    const gameConfig = normalizeSoloGameConfig(game, rawConfig);
    const setFingerprint = await fingerprintLearningSet(set);
    if (!mounted.current) return;
    const newRun = await startSoloRun({
      tenantId: identity.tenantId,
      gameId: game.id,
      setId: set.id,
      setFingerprint,
      gameConfig,
      nickname: player.nickname,
    });
    if (!mounted.current) {
      await abandonSoloRun(newRun).catch(console.error);
      return;
    }
    activeRun.current = newRun;
    setLearningSet(set);
    setRun(newRun);
  };

  const finish = useCallback(async (): Promise<void> => {
    if (!run) return;
    if (finishInFlight.current) return finishInFlight.current;
    const promise = finishSoloRun(run)
      .then((value) => {
        const completed = { ...run, status: "completed" as const, completedAtMs: value.result.completedAtMs, finalResult: value.result };
        activeRun.current = completed;
        setRun(completed);
        setFinishResult(value);
        setError("");
      })
      .catch((value: unknown) => {
        setError(value instanceof Error ? value.message : "Solo 결과를 저장하지 못했습니다.");
        throw value;
      })
      .finally(() => { finishInFlight.current = null; });
    finishInFlight.current = promise;
    return promise;
  }, [run]);

  const exit = async (): Promise<void> => {
    const active = activeRun.current;
    if (active?.status === "active") {
      try {
        await abandonSoloRun(active);
        const abandoned = { ...active, status: "abandoned" as const };
        activeRun.current = abandoned;
        setRun(abandoned);
      } catch (value: unknown) {
        setError(value instanceof Error ? value.message : "진행 중인 Solo 게임을 종료하지 못했습니다.");
        throw value;
      }
    }
    onReturnToLobby();
  };

  if (finishResult) return <SoloResults result={finishResult} onReturn={onReturnToLobby} />;
  if (run && learningSet) return <div className={styles.experience}>
    {error ? <StatusPanel title="Solo 저장 오류" tone="error">{error}</StatusPanel> : null}
    <SoloGameHost run={run} set={learningSet} player={player} onFinish={finish} onExit={exit} />
  </div>;
  return <SoloSetup tenantId={identity.tenantId} onStart={start} onCancel={onReturnToLobby} />;
}

function SoloResults({ result, onReturn }: { readonly result: SoloFinishResult; readonly onReturn: () => void }) {
  return <div className={styles.results}>
    <Card className={styles.resultCard}>
      <span className={styles.eyebrow}>혼자하기 완료</span>
      <h2>이번 점수</h2>
      <strong className={styles.score}>{result.result.score}점</strong>
      <p>정답 {result.result.correctCount}개 · 풀이 {result.result.attemptCount}회 · 최고 콤보 {result.result.combo}</p>
      <p>내 최고 기록 <strong>{result.best.score}점</strong></p>
    </Card>
    <Card className={styles.resultCard}>
      <h2>같은 조건의 상위 기록</h2>
      {result.leaderboard.length === 0 ? <p>아직 등록된 기록이 없습니다.</p> : <ol className={styles.leaderboard}>
        {result.leaderboard.map((record) => <li key={`${record.rank}:${record.completedAtMs}`}><span>{record.rank}위 · {record.displayLabel}</span><strong>{record.score}점</strong></li>)}
      </ol>}
      <Button onClick={onReturn}>대기실로 돌아가기</Button>
    </Card>
  </div>;
}
