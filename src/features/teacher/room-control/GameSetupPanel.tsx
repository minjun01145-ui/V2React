import { TIMED_GAME_MODE_OPTIONS, isTimedGameMode } from "../../../game-engine/timed-game/config.ts";
import { minimumSetItemCountForType } from "../../../game-engine/contracts/gameDefinition.ts";
import { isLearningSetType, learningSetTypeLabel } from "../../../learning-sets/types.ts";
import Card from "../../../shared/ui/Card.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import type { GameSetupState } from "./useGameSetup.ts";
import styles from "./TeacherRoomController.module.css";

interface Props {
  readonly setup: GameSetupState;
  readonly disabled: boolean;
}

export function GameSetupPanel({ setup, disabled }: Props) {
  const { availableGames, selectedGame, compatibleSets, selectedSetId, timedMode, setError, invalidSet, minimumSetItemCount } = setup;
  const setRequirements = selectedGame.supportedSetTypes.map((type) => {
    const label = isLearningSetType(type) ? learningSetTypeLabel(type) : type;
    return `${label} ${minimumSetItemCountForType(selectedGame, type)}개 이상`;
  }).join(" · ");
  return <Card className={styles.setPicker}>
    <div><h2>{selectedGame.title}</h2><Muted>{setRequirements}{selectedGame.timing === "timed" ? " · 시간제" : ""}</Muted></div>
    <div className={styles.pickerControls}>
      <label>게임<select value={selectedGame.id} onChange={(event) => setup.selectGame(event.target.value)} disabled={disabled}>{availableGames.map((game) => <option value={game.id} key={game.id}>{game.title}</option>)}</select></label>
      <label>학습 세트<select value={selectedSetId} onChange={(event) => setup.selectSet(event.target.value)} disabled={disabled}><option value="" disabled={selectedGame.requiresStoredSet}>{selectedGame.requiresStoredSet ? "저장된 세트를 선택하세요" : "내장 데모 세트"}</option>{compatibleSets.map((set) => <option value={set.id} key={set.id}>{set.name} ({set.itemCount}개)</option>)}</select></label>
      {selectedGame.settings.map((setting) => <label key={setting.key}>{setting.label}<select value={setup.settingValues[setting.key] ?? setting.defaultValue} onChange={(event) => setup.selectSetting(setting.key, event.target.value)} disabled={disabled}>{setting.options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>)}
      {selectedGame.timing === "timed" ? <label>게임 시간<select value={timedMode} onChange={(event) => { if (isTimedGameMode(event.target.value)) setup.selectTimedMode(event.target.value); }} disabled={disabled}>{TIMED_GAME_MODE_OPTIONS.map((option) => <option value={option.mode} key={option.mode}>{option.label} 모드</option>)}</select></label> : null}
    </div>
    {setError ? <p className={styles.setError}>{setError}</p> : null}
    {invalidSet ? <p className={styles.setError}>{selectedGame.requiresStoredSet && !setup.selectedSet ? `${selectedGame.title}을(를) 위해 저장된 학습 세트를 선택해 주세요.` : `${selectedGame.title}을(를) 위해 이 세트에는 ${minimumSetItemCount}개 이상의 문항이 필요합니다.`}</p> : null}
  </Card>;
}
