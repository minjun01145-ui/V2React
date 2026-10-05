import { TIMED_GAME_MODE_OPTIONS, isTimedGameMode } from "../../../game-engine/timed-game/config.ts";
import Field from "../../../shared/ui/Field.tsx";
import Select from "../../../shared/ui/Select.tsx";
import GamePicker from "./GamePicker.tsx";
import type { GameSetupState } from "./useGameSetup.ts";
import styles from "./GameSetupPanel.module.css";

interface Props {
  readonly setup: GameSetupState;
  readonly disabled: boolean;
}

export function GameSetupPanel({ setup, disabled }: Props) {
  const { availableGames, selectedGame, compatibleSets, selectedSetId, timedMode, setError, invalidSet, minimumSetItemCount } = setup;
  return <div className={styles.gameSetup}>
    <div className={styles.pickerControls}>
      <Field label="학습 세트"><Select value={selectedSetId} onChange={(event) => setup.selectSet(event.target.value)} disabled={disabled}><option value="" disabled={selectedGame.requiresStoredSet}>{selectedGame.requiresStoredSet ? "저장된 세트를 선택하세요" : "내장 데모 세트"}</option>{compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount}개)</option>)}</Select></Field>
      {selectedGame.settings.map((setting) => <Field key={setting.key} label={setting.label}><Select value={setup.settingValues[setting.key] ?? setting.defaultValue} onChange={(event) => setup.selectSetting(setting.key, event.target.value)} disabled={disabled}>{setting.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</Select></Field>)}
      {selectedGame.timing === "timed" && selectedGame.fixedTimedMode === null ? <Field label="게임 시간"><Select value={timedMode} onChange={(event) => { if (isTimedGameMode(event.target.value)) setup.selectTimedMode(event.target.value); }} disabled={disabled}>{TIMED_GAME_MODE_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.label} 모드</option>)}</Select></Field> : null}
      {selectedGame.timing === "timed" && selectedGame.fixedTimedMode !== null ? <Field label="게임 시간"><Select value={selectedGame.fixedTimedMode} disabled><option value={selectedGame.fixedTimedMode}>{TIMED_GAME_MODE_OPTIONS.find((option) => option.mode === selectedGame.fixedTimedMode)?.label ?? "고정"} 고정</option></Select></Field> : null}
    </div>
    {setError ? <p className={styles.setError}>{setError}</p> : null}
    {invalidSet ? <p className={styles.setError}>{selectedGame.requiresStoredSet && !setup.selectedSet ? `${selectedGame.title}을(를) 위해 저장된 학습 세트를 선택해 주세요.` : `${selectedGame.title}을(를) 위해 이 세트에는 ${minimumSetItemCount}개 이상의 문항이 필요합니다.`}</p> : null}
    <GamePicker games={availableGames} selectedId={selectedGame.id} onSelect={setup.selectGame} disabled={disabled} />
  </div>;
}
