import { findCharacter } from "../characters/catalog.ts";
import DiceDisplay from "../dice/DiceDisplay.tsx";
import { diceTotal, type DiceCount, type DicePhase } from "../dice/model.ts";
import type { Player } from "../multiplayer/types.ts";
import { useCharacterStandFrame } from "../shared/useCharacterStandFrame.ts";
import styles from "./WaitingDice.module.css";

export interface WaitingDicePresentation {
  readonly phase: DicePhase | "requested";
  readonly diceCount: DiceCount;
  readonly results: readonly number[];
  readonly rollerId: string | null;
  readonly rollerLabel: string;
}

function RollerAvatar({ player, label, bouncing }: {
  readonly player: Player | undefined;
  readonly label: string;
  readonly bouncing: boolean;
}) {
  const character = player?.avatar?.kind === "character" ? findCharacter(player.avatar.characterId) : null;
  const characterFrame = useCharacterStandFrame(character?.standFrames ?? null);
  return (
    <div className={styles.roller} data-bouncing={bouncing ? "true" : undefined}>
      <div className={styles.avatar} data-empty={characterFrame || player?.avatar?.kind === "pokemon" ? undefined : "true"}>
        {characterFrame ? <img src={characterFrame} alt={`${character?.name ?? label} 캐릭터`} draggable={false} /> : null}
        {player?.avatar?.kind === "pokemon" ? <img src={player.avatar.spriteUrl} alt={`${player.avatar.name} 포켓몬`} /> : null}
        {!characterFrame && player?.avatar?.kind !== "pokemon" ? <span aria-hidden="true">{label.slice(0, 1)}</span> : null}
      </div>
      <strong>{label}</strong>
    </div>
  );
}

export default function WaitingDiceStage({ state, player }: {
  readonly state: WaitingDicePresentation | null;
  readonly player: Player | undefined;
}) {
  const rolling = state?.phase === "rolling";
  const requested = state?.phase === "requested";
  const diceCount = state?.diceCount ?? 1;
  const label = state?.rollerLabel ?? "굴릴 사람";
  return (
    <div className={styles.stage} aria-live="polite">
      {state?.rollerId ? <RollerAvatar player={player} label={label} bouncing={requested} /> : null}
      <div className={styles.diceArea}>
        <DiceDisplay phase={state?.phase === "requested" ? "idle" : (state?.phase ?? "idle")} diceCount={diceCount} results={state?.results ?? []} />
        <p className={styles.stageMessage}>
          {!state ? "주사위를 준비했어요." : null}
          {state?.phase === "idle" ? "주사위를 준비했어요." : null}
          {requested ? `${label} 학생의 굴리기를 기다리는 중이에요.` : null}
          {rolling ? `${label}이(가) 주사위를 굴리고 있어요!` : null}
          {state?.phase === "result" ? `${label}의 결과: ${state.results.join(" + ")} = ${diceTotal(state.results)}` : null}
        </p>
      </div>
    </div>
  );
}
