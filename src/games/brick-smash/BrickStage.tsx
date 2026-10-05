import { useRef, type CSSProperties } from "react";
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
const vars = (values: Record<string, string | number>) => values as CSSProperties;

/** Stable trajectories; CSS only interpolates distances and angles with units. */
export function burst(count: number, radius: number, seed: number): CSSProperties[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count * Math.PI * 2) + seed * .73;
    const distance = radius * (.6 + ((index * 17 + seed * 13) % 31) / 75);
    return vars({ "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
      "--dy": `${Math.round(Math.sin(angle) * distance * .65 - radius * .25)}px`,
      "--rot": `${(index % 2 ? -1 : 1) * (180 + index * 37)}deg` });
  });
}

function Brick({ brick, className, style }: { readonly brick: StageBrick; readonly className?: string | undefined; readonly style?: CSSProperties }) {
  return <div className={`${styles.brick} ${className ?? ""}`} data-item={brick.item ?? undefined} style={style}>
    <i className={styles.shine} aria-hidden="true" />
    {brick.text && <span className={styles.brickText}>{brick.text}</span>}
    {brick.item && <span className={styles.itemTag}>{BRICK_ITEMS[brick.item].emoji} {BRICK_ITEMS[brick.item].name}</span>}
  </div>;
}

function Hammer({ golden, defineGradient = true }: { readonly golden: boolean; readonly defineGradient?: boolean }) {
  const head = golden ? ["#fff6df", "#ffc83d", "#e0a800"] : ["#ffffff", "#8fa2ff", "#2338b8"];
  const id = golden ? "brick-hammer-golden" : "brick-hammer-normal";
  return <svg viewBox="0 0 200 200" aria-hidden="true">
    {defineGradient && <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={head[0]} /><stop offset=".5" stopColor={head[1]} /><stop offset="1" stopColor={head[2]} />
      </linearGradient>
    </defs>}
    <rect x="87" y="58" width="28" height="132" rx="12" fill="#ffd23f" stroke="#16205a" strokeWidth="7" />
    <rect x="88" y="142" width="26" height="45" rx="10" fill="#fff6df" />
    <path d="M91 150h20m-20 13h20m-20 13h20" stroke="#16205a" strokeWidth="6" />
    <rect x="15" y="18" width="170" height="70" rx="22" fill={`url(#${id})`} stroke="#16205a" strokeWidth="8" />
    <rect x="36" y="22" width="14" height="62" rx="5" fill="#16205a" />
    <rect x="150" y="22" width="14" height="62" rx="5" fill="#16205a" />
    <path d="M62 34h68q9 0 13 7" fill="none" stroke="#fff6df" strokeWidth="8" strokeLinecap="round" />
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
  /** Restarts the bonus fuse whenever a new brick becomes the target. */
  readonly timerKey: number;
  readonly onImpactDone: (id: number) => void;
}) {
  const motion = impact?.correct ? impact.bomb ? styles.quake : styles.shake : "";
  const stageKey = useRef(0);
  if (impact) stageKey.current = impact.id;
  const swing = impact ? impact.correct || impact.protectedMiss ? styles.swing : styles.bounce : styles.hammerIdle;
  const { fastMs, slowMs, min, max } = BRICK_SCORING;
  return <div className={styles.stageWrap}>
    <div className={styles.floor} aria-hidden="true" />
    <div key={`stage-${stageKey.current}`} className={`${styles.stage} ${motion}`} style={vars({ "--shake": `${Math.min(4 + (impact?.combo ?? 0) / 2, 12)}px` })}>
      <div className={styles.stack} key={bricks[0]?.index ?? 0} data-drop={impact?.correct ? impact.bomb ? "bomb" : "hit" : undefined}
        data-miss={impact && !impact.correct ? impact.protectedMiss ? "blocked" : "miss" : undefined}
        style={vars({ "--drop-count": impact?.correct ? impact.bricks.length : 0 })}>
        {[...bricks].reverse().map((brick, reversed) => {
          const offset = bricks.length - 1 - reversed;
          return <Brick key={brick.index} brick={brick} className={offset === 0 ? `${styles.current} ${shielded ? styles.shielded : ""}` : styles[`upper${offset}`]} />;
        })}
        <div key={timerKey} className={styles.fuse} aria-hidden="true"
          style={vars({ "--fast": `${fastMs}ms`, "--slow": `${slowMs - fastMs}ms`, "--floor": min / max })}><i /></div>
      </div>
      {twin && <div key={`twin-${impact?.id ?? 0}`} data-twin="true" className={`${styles.hammer} ${swing}`}><Hammer golden={golden} defineGradient={false} /></div>}
      <div key={`hammer-${impact?.id ?? 0}`} data-golden={golden} className={`${styles.hammer} ${swing}`}><Hammer golden={golden} /></div>
    </div>
    {impacts.map((hit) => <div key={hit.id} className={styles.impact} aria-hidden="true" data-gold={hit.gold} style={vars({ "--side": hit.side })}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) onImpactDone(hit.id); }}>
      {hit.correct ? <>
        {hit.bricks.map((brick, offset) => hit.bomb
          ? <div key={brick.index} className={styles.blastSlot} style={vars({ "--offset": offset, "--delay": `${offset * BLAST_STEP_MS}ms` })}>
            <Brick brick={brick} className={styles.exploding} />
            <i className={styles.fireball} /><i className={styles.blastRing} />
            {burst(8, 240, hit.id + offset).map((style, i) => <i key={i} className={styles.debris} style={style} />)}
          </div>
          : <div key={brick.index} className={styles.splitSlot} style={vars({ "--offset": offset, "--delay": `${offset * 70}ms` })}>
            <Brick brick={brick} className={`${styles.flying} ${styles.halfLeft}`} style={vars({ "--side": -1 })} />
            <Brick brick={brick} className={`${styles.flying} ${styles.halfRight}`} style={vars({ "--side": 1 })} />
          </div>)}
        {!hit.bomb && <><div className={styles.impactStar}><i /></div><div className={styles.ring} />
          {burst(12, 150, hit.id).map((style, i) => <i key={i} className={styles.chunk} style={style} />)}
          {burst(5, 90, hit.id).map((style, i) => <i key={`dust-${i}`} className={styles.dust} style={style} />)}</>}
        {hit.judgment === "perfect" && burst(6, 130, hit.id).map((style, i) => <i key={`sparkle-${i}`} className={styles.sparkle} style={style}>✦</i>)}
        {hit.gold && Array.from({ length: 9 }, (_, i) => <i key={`coin-${i}`} className={styles.coin}
          style={vars({ "--dx": `${(i - 4) * 46}px`, "--dy": `${-150 - i % 3 * 30}px`, "--rot": `${(i % 2 ? -1 : 1) * 45}deg` })}>$</i>)}
        <b className={styles.popup} data-size={hit.score >= 200 ? "large" : hit.score >= 100 ? "medium" : "small"}>
          +{hit.score.toLocaleString()}{hit.gold && <em>×2</em>}
        </b>
        {hit.bomb && <><i className={styles.boomFlash} /><b className={styles.boomText}>BOOM ×{hit.bricks.length}</b></>}
      </> : <>
        <b className={styles.clang} data-blocked={hit.protectedMiss}>{hit.protectedMiss ? "BLOCK" : "MISS"}</b>
        {hit.protectedMiss ? <i className={styles.hexFlash} /> : <><i className={styles.missStamp} /><i className={styles.vignette} /></>}
        {hit.brokenCombo >= 5 && <b className={styles.comboBreak}>{hit.brokenCombo} COMBO BREAK</b>}
      </>}
    </div>)}
  </div>;
}
