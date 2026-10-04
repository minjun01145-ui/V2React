import type { CSSProperties } from "react";
import { BRICK_ITEMS, type BrickItemId } from "./items.ts";
import { BRICK_SCORING, type BrickJudgment } from "./model.ts";
import styles from "./BrickSmash.module.css";

export interface StageBrick { readonly index: number; readonly text: string; readonly item: BrickItemId | null }
export interface Impact {
  readonly id: number;
  readonly correct: boolean;
  readonly protectedMiss: boolean;
  readonly bricks: readonly StageBrick[];
  readonly side: 1 | -1;
  readonly score: number;
  readonly judgment: BrickJudgment | null;
  readonly bomb: boolean;
  readonly gold: boolean;
  readonly combo: number;
  readonly brokenCombo: number;
}

/** Delay between the chained blasts of a bomb, shared with the sound schedule. */
export const BLAST_STEP_MS = 120;
const JUDGMENT_TEXT: Record<BrickJudgment, string> = { perfect: "PERFECT", great: "GREAT", good: "GOOD" };
const vars = (values: Record<string, string | number>) => values as CSSProperties;

function Brick({ brick, className, style }: { readonly brick: StageBrick; readonly className?: string | undefined; readonly style?: CSSProperties }) {
  return <div className={`${styles.brick} ${className ?? ""}`} data-item={brick.item ?? undefined} style={style}>
    {brick.text && <span className={styles.brickText}>{brick.text}</span>}
    {brick.item && <span className={styles.itemTag}>{BRICK_ITEMS[brick.item].emoji} {BRICK_ITEMS[brick.item].name}</span>}
  </div>;
}

function Hammer({ golden }: { readonly golden: boolean }) {
  const head = golden ? ["#fff4b8", "#ffc83d", "#a86a00"] : ["#f4f6fb", "#b9c1d6", "#5d6683"];
  const id = golden ? "gold" : "steel";
  return <svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id={`brick-hammer-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={head[0]} /><stop offset=".5" stopColor={head[1]} /><stop offset="1" stopColor={head[2]} />
      </linearGradient>
    </defs>
    <rect x="90" y="64" width="22" height="126" rx="4" fill="#2a2f45" stroke="#05070f" strokeWidth="5" />
    <rect x="90" y="140" width="22" height="50" rx="4" fill="#ff3b5c" stroke="#05070f" strokeWidth="5" />
    <path d="M24 22h150l8 10v38l-8 10H24l-8-10V32Z" fill={`url(#brick-hammer-${id})`} stroke="#05070f" strokeWidth="6" />
    <path d="M30 31h96" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity=".8" />
  </svg>;
}

export default function BrickStage({ bricks, impact, impacts, golden, twin, shielded, timerKey, onImpactDone }: {
  /** Bottom brick first. */
  readonly bricks: readonly StageBrick[];
  readonly impact: Impact | null;
  readonly impacts: readonly Impact[];
  readonly golden: boolean;
  readonly twin: boolean;
  readonly shielded: boolean;
  /** Restarts the speed gauge whenever a new brick becomes the target. */
  readonly timerKey: number;
  readonly onImpactDone: (id: number) => void;
}) {
  const motion = !impact ? "" : impact.bomb ? styles.quake : impact.correct ? styles.shake : impact.protectedMiss ? styles.blocked : styles.recoil;
  const swing = impact ? impact.correct || impact.protectedMiss ? styles.swing : styles.bounce : "";
  const { fastMs, slowMs, min, max } = BRICK_SCORING;
  return <div className={styles.stageWrap}>
    <div className={styles.gear} aria-hidden="true" />
    <div key={`stage-${impact?.id ?? 0}`} className={`${styles.stage} ${motion}`} style={vars({ "--shake": `${Math.min(4 + (impact?.combo ?? 0) / 2, 12)}px` })}>
      <div className={styles.stack} key={bricks[0]?.index ?? 0} data-drop={impact?.correct ? impact.bomb ? "bomb" : "hit" : undefined}
        style={vars({ "--drop-count": impact?.correct ? impact.bricks.length : 0 })}>
        {[...bricks].reverse().map((brick, reversed) => {
          const offset = bricks.length - 1 - reversed;
          return <Brick key={brick.index} brick={brick} className={offset === 0 ? `${styles.current} ${shielded ? styles.shielded : ""}` : styles[`upper${offset}`]} />;
        })}
        <div key={timerKey} className={styles.speed} aria-hidden="true"
          style={vars({ "--fast": `${fastMs}ms`, "--slow": `${slowMs - fastMs}ms`, "--floor": min / max })}><i /></div>
      </div>
      <div className={styles.judgeLine} aria-hidden="true" />
      {twin && <div key={`twin-${impact?.id ?? 0}`} data-twin="true" className={`${styles.hammer} ${swing}`}><Hammer golden={golden} /></div>}
      <div key={`hammer-${impact?.id ?? 0}`} data-golden={golden} className={`${styles.hammer} ${swing}`}><Hammer golden={golden} /></div>
    </div>
    {impacts.map((hit) => <div key={hit.id} className={styles.impact} aria-hidden="true" data-gold={hit.gold} style={vars({ "--side": hit.side })}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) onImpactDone(hit.id); }}>
      {hit.correct ? <>
        {hit.bricks.map((brick, offset) => hit.bomb
          ? <div key={brick.index} className={styles.blastSlot} style={vars({ "--offset": offset, "--delay": `${offset * BLAST_STEP_MS}ms` })}>
            <Brick brick={brick} className={styles.exploding} />
            <i className={styles.fireball} /><i className={styles.blastRing} />
            {Array.from({ length: 6 }, (_, i) => <i key={i} className={styles.debris} style={vars({ "--i": i })} />)}
          </div>
          : <Brick key={brick.index} brick={brick} className={styles.flying} style={vars({ "--offset": offset, "--side": offset % 2 ? -hit.side : hit.side, "--delay": `${offset * 70}ms` })} />)}
        {!hit.bomb && <><div className={styles.flash} /><div className={styles.ring} />
          {Array.from({ length: 10 }, (_, i) => <i key={i} className={styles.shard} style={vars({ "--i": i })} />)}</>}
        {hit.gold && Array.from({ length: 9 }, (_, i) => <i key={`coin-${i}`} className={styles.coin} style={vars({ "--i": i })} />)}
        {hit.bomb && <b className={styles.boomText}>BOOM ×{hit.bricks.length}</b>}
      </> : <>
        <b className={styles.clang} data-blocked={hit.protectedMiss}>{hit.protectedMiss ? "BLOCK" : "MISS"}</b>
        <i className={styles.sparks} />
        {hit.brokenCombo >= 5 && <b className={styles.comboBreak}>{hit.brokenCombo} COMBO BREAK</b>}
      </>}
    </div>)}
  </div>;
}

export function Judgment({ hit }: { readonly hit: Impact }) {
  return <div className={styles.judgment} data-judgment={hit.judgment ?? undefined} data-gold={hit.gold} aria-hidden="true">
    <strong>{hit.judgment ? JUDGMENT_TEXT[hit.judgment] : ""}</strong>
    <span>+{hit.score.toLocaleString()}{hit.gold && <em>×2</em>}</span>
  </div>;
}
