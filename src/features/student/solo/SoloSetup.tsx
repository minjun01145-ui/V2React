import { useEffect, useMemo, useState } from "react";
import { minimumSetItemCountForType, type GameDefinition } from "../../../game-engine/contracts/gameDefinition.ts";
import { DEFAULT_TIMED_GAME_MODE, TIMED_GAME_MODE_OPTIONS, isTimedGameMode, type TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import { listGames } from "../../../games/registry.ts";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import { tenantConfig } from "../../../tenant/config.ts";
import styles from "./StudentSolo.module.css";

const availableGames = listGames().filter((game) => game.solo.supported);

function defaultSettings(game: GameDefinition): Readonly<Record<string, string>> {
  return Object.fromEntries(game.settings.map((setting) => [setting.key, setting.defaultValue]));
}

export default function SoloSetup({ tenantId, onStart, onCancel }: {
  readonly tenantId: "minjun" | "hana";
  readonly onStart: (game: GameDefinition, set: LearningSetSummary, config: Readonly<Record<string, unknown>>) => Promise<void>;
  readonly onCancel: () => void;
}) {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const [gameId, setGameId] = useState(availableGames[0]?.id ?? "");
  const [setId, setSetId] = useState("");
  const [timedMode, setTimedMode] = useState<TimedGameMode>(DEFAULT_TIMED_GAME_MODE);
  const [settings, setSettings] = useState<Readonly<Record<string, string>>>(() => availableGames[0] ? defaultSettings(availableGames[0]) : {});
  const game = useMemo(() => availableGames.find((candidate) => candidate.id === gameId) ?? availableGames[0] ?? null, [gameId]);
  const compatibleSets = useMemo(() => game ? sets.filter((set) => game.supportedSetTypes.includes(set.type)) : [], [game, sets]);
  const selectedSet = compatibleSets.find((set) => set.id === setId) ?? compatibleSets[0] ?? null;
  const minimum = selectedSet && game ? minimumSetItemCountForType(game, selectedSet.type) : game?.minimumSetItemCount ?? 0;
  const invalidSet = !selectedSet || selectedSet.itemCount < minimum;

  useEffect(() => {
    let active = true;
    void listLearningSets()
      .then((next) => {
        if (!active) return;
        setSets(next);
        const initial = availableGames[0];
        setSetId(initial ? next.find((set) => initial.supportedSetTypes.includes(set.type))?.id ?? "" : "");
        setLoading(false);
      })
      .catch((value: unknown) => {
        if (!active) return;
        setError(toErrorMessage(value, "학습 세트 목록을 불러오지 못했습니다."));
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const selectGame = (nextId: string): void => {
    const nextGame = availableGames.find((candidate) => candidate.id === nextId);
    if (!nextGame) return;
    setGameId(nextId);
    setSettings(defaultSettings(nextGame));
    setSetId(sets.find((set) => nextGame.supportedSetTypes.includes(set.type))?.id ?? "");
  };

  const start = async (): Promise<void> => {
    if (!game || !selectedSet || invalidSet || starting) return;
    setStarting(true);
    setError("");
    try {
      await onStart(game, selectedSet, {
        setId: selectedSet.id,
        ...settings,
        ...(game.timing === "timed" ? { timedGameMode: game.fixedTimedMode ?? timedMode } : {}),
      });
    } catch (value: unknown) {
      setError(toErrorMessage(value, "Solo 게임을 시작하지 못했습니다."));
      setStarting(false);
    }
  };

  if (loading) return <StatusPanel title="Solo 준비 중" tone="waiting">현재 테넌트의 학습 세트를 불러오고 있습니다.</StatusPanel>;
  if (!game) return <StatusPanel title="Solo 게임을 찾을 수 없습니다" tone="error">현재 지원하는 Solo 게임이 없습니다.</StatusPanel>;
  return <Card className={styles.setup}>
    <div className={styles.heading}><div><span className={styles.eyebrow}>혼자하기</span><h2>게임 설정</h2></div><span>{tenantConfig(tenantId).brandName}</span></div>
    <div className={styles.fields}>
      <label>게임<select value={game.id} onChange={(event) => selectGame(event.target.value)} disabled={starting}>
        {availableGames.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.title}</option>)}
      </select></label>
      <label>학습 세트<select value={selectedSet?.id ?? ""} onChange={(event) => setSetId(event.target.value)} disabled={starting}>
        <option value="" disabled>학습 세트를 선택하세요</option>
        {compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount}개)</option>)}
      </select></label>
      {game.settings.map((setting) => <label key={setting.key}>{setting.label}<select value={settings[setting.key] ?? setting.defaultValue} onChange={(event) => setSettings((current) => ({ ...current, [setting.key]: event.target.value }))} disabled={starting}>
        {setting.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select></label>)}
      {game.timing === "timed" && game.fixedTimedMode === null ? <label>게임 시간<select value={timedMode} onChange={(event) => { if (isTimedGameMode(event.target.value)) setTimedMode(event.target.value); }} disabled={starting}>
        {TIMED_GAME_MODE_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.mode === "unlimited" ? "무제한" : option.label}</option>)}
      </select></label> : null}
    </div>
    {invalidSet ? <p className={styles.hint}>{selectedSet ? `${game.title}에는 ${minimum}개 이상의 문항이 필요합니다.` : `${game.title}에 사용할 학습 세트를 선택해 주세요.`}</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.actions}><Button variant="ghost" disabled={starting} onClick={onCancel}>대기실로 돌아가기</Button><Button disabled={invalidSet || starting} onClick={() => void start()}>{starting ? "준비 중…" : "시작"}</Button></div>
  </Card>;
}
