import { useEffect, useMemo, useState } from "react";
import { minimumSetItemCountForType, type GameDefinition } from "../../../game-engine/contracts/gameDefinition.ts";
import { DEFAULT_TIMED_GAME_MODE, withTimedGameConfig, type TimedGameMode } from "../../../game-engine/timed-game/config.ts";
import { getGame, listGames } from "../../../games/registry.ts";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";

const INITIAL_GAME_ID = "pokemon-catch";

function defaultSettingValues(game: GameDefinition): Readonly<Record<string, string>> {
  return Object.fromEntries(game.settings.map((setting) => [setting.key, setting.defaultValue]));
}

export interface GameSetupState {
  readonly availableGames: readonly GameDefinition[];
  readonly selectedGame: GameDefinition;
  readonly compatibleSets: readonly LearningSetSummary[];
  readonly selectedSetId: string;
  readonly timedMode: TimedGameMode;
  readonly settingValues: Readonly<Record<string, string>>;
  readonly setError: string;
  readonly invalidSet: boolean;
  readonly minimumSetItemCount: number;
  readonly selectGame: (gameId: string) => void;
  readonly selectSet: (setId: string) => void;
  readonly selectTimedMode: (mode: TimedGameMode) => void;
  readonly selectSetting: (key: string, value: string) => void;
  readonly buildGameConfig: () => Readonly<Record<string, unknown>>;
}

export function useGameSetup(): GameSetupState {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const availableGames = useMemo(() => listGames().filter((game) => game.supportedSetTypes.length > 0), []);
  const [gameId, setGameId] = useState(INITIAL_GAME_ID);
  const [selectedSetId, setSelectedSetId] = useState("");
  const [timedMode, setTimedMode] = useState<TimedGameMode>(DEFAULT_TIMED_GAME_MODE);
  const [settingValues, setSettingValues] = useState<Readonly<Record<string, string>>>(() => defaultSettingValues(getGame(INITIAL_GAME_ID)));
  const [setError, setSetError] = useState("");

  useEffect(() => {
    let active = true;
    void listLearningSets()
      .then((next) => {
        if (!active) return;
        setSets(next);
        const initialGame = getGame(INITIAL_GAME_ID);
        const compatible = next.filter((set) => initialGame.supportedSetTypes.includes(set.type));
        setSelectedSetId((current) => current && compatible.some((set) => set.id === current) ? current : (compatible[0]?.id ?? ""));
      })
      .catch((value: unknown) => { if (active) setSetError(toErrorMessage(value, "학습 세트 목록을 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, []);

  const selectedGame = useMemo(() => getGame(gameId), [gameId]);
  const compatibleSets = useMemo(() => sets.filter((set) => selectedGame.supportedSetTypes.includes(set.type)), [selectedGame, sets]);
  const selectedSet = useMemo(() => compatibleSets.find((set) => set.id === selectedSetId) ?? null, [compatibleSets, selectedSetId]);
  const minimumSetItemCount = selectedSet
    ? minimumSetItemCountForType(selectedGame, selectedSet.type)
    : selectedGame.minimumSetItemCount;
  const invalidSet = Boolean(selectedSet && selectedSet.itemCount < minimumSetItemCount);

  const selectGame = (nextGameId: string): void => {
    const nextGame = getGame(nextGameId);
    setGameId(nextGameId);
    setSettingValues(defaultSettingValues(nextGame));
    setSelectedSetId(sets.find((set) => nextGame.supportedSetTypes.includes(set.type))?.id ?? "");
  };

  const buildGameConfig = (): Readonly<Record<string, unknown>> => {
    const baseConfig: Readonly<Record<string, unknown>> = { ...(selectedSet ? { setId: selectedSet.id } : {}), ...settingValues };
    return selectedGame.timing === "timed" ? withTimedGameConfig(baseConfig, timedMode) : baseConfig;
  };

  return {
    availableGames,
    selectedGame,
    compatibleSets,
    selectedSetId,
    timedMode,
    settingValues,
    setError,
    invalidSet,
    minimumSetItemCount,
    selectGame,
    selectSet: setSelectedSetId,
    selectTimedMode: setTimedMode,
    selectSetting: (key, value) => setSettingValues((current) => ({ ...current, [key]: value })),
    buildGameConfig,
  };
}
