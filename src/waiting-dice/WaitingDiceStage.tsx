import DiceDisplay from "../dice/DiceDisplay.tsx";
import { diceTotal, type DiceCount, type DicePhase } from "../dice/model.ts";
import type { Player } from "../multiplayer/types.ts";
import RollerAvatar from "./RollerAvatar.tsx";
import styles from "./WaitingDiceStage.module.css";

export interface WaitingDicePresentation {
  readonly phase: DicePhase | "requested";
  readonly diceCount: DiceCount;
  readonly results: readonly number[];
  readonly rollerId: string | null;
  readonly rollerLabel: string;
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
