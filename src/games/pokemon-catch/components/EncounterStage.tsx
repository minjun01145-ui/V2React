import { PokemonSprite } from "../PokemonSprite.tsx";
import type { EncounterLoadStatus, EncounterPhase, PokemonEncounter } from "../types.ts";
import styles from "../PokemonCatch.module.css";

interface Props {
  readonly encounter: PokemonEncounter | null;
  readonly encounterStatus: EncounterLoadStatus;
  readonly phase: EncounterPhase;
  readonly asleep: boolean;
  readonly secondsRemaining: number;
  readonly timerMaximum: number;
  readonly remainingMs: number;
  readonly loadError: string;
  readonly onReload: () => void;
}

export function EncounterStage({ encounter, encounterStatus, phase, asleep, secondsRemaining, timerMaximum, remainingMs, loadError, onReload }: Props) {
  return <main className={styles.field} data-phase={phase}>
    <div className={styles.skyGlow} />
    <div className={styles.encounterCard}>
      <span>{encounter ? `No.${String(encounter.id).padStart(3, "0")}` : "SEARCHING"}</span>
      <strong>{encounter?.name ?? "야생 포켓몬 탐색 중"}</strong>
      {asleep ? <small>잠듦 · 포획률 2배</small> : null}
    </div>
    {encounterStatus === "ready" ? <div className={styles.timerPanel} data-warning={secondsRemaining <= 10}>
      <strong>{secondsRemaining}초</strong><progress max={timerMaximum} value={remainingMs} />
    </div> : null}
    <div className={styles.pokemonStage}>
      {encounter ? <PokemonSprite className={styles.pokemon} pokemon={encounter} alt={encounter.name} /> : null}
      {phase === "loading" ? <div className={styles.scanner}>탐색 중</div> : null}
      {phase === "error" ? <div className={styles.apiError}><strong>연결 실패</strong><span>{loadError}</span><button type="button" onClick={onReload}>다시 불러오기</button></div> : null}
      <div className={styles.shadow} /><div className={styles.ball} aria-hidden="true"><i /></div>
      {phase === "caught" ? <div className={styles.resultBurst}>GET!</div> : null}
      {phase === "failed" ? <div className={styles.failedText}>아깝다!</div> : null}
      {phase === "escaped" ? <div className={styles.escapeText}>시간 종료!</div> : null}
    </div>
    <div className={styles.grass}><i /><i /><i /><i /><i /><i /></div>
  </main>;
}
