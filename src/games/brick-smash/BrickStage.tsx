import type { CSSProperties } from "react";
import { BRICK_ITEMS, type BrickItemId } from "./items.ts";
import styles from "./BrickSmash.module.css";

export interface StageBrick { readonly index: number; readonly text: string; readonly item: BrickItemId | null }
export interface Impact {
  readonly id: number;
  readonly correct: boolean;
  readonly protectedMiss: boolean;
  readonly bricks: readonly StageBrick[];
  readonly side: 1 | -1;
  readonly score: number;
  readonly bomb: boolean;
  readonly combo: number;
}

const BRICK_COLORS = ["#ff7a7a", "#ffb05c", "#ffe066", "#7ee08a", "#5cc4ff", "#a98bff", "#ff8fc6"];
const brickStyle = (index: number, extra?: Record<string, string | number>) =>
  ({ "--brick": BRICK_COLORS[index % BRICK_COLORS.length], ...extra }) as CSSProperties;

function Brick({ brick, className, style }: { readonly brick: StageBrick; readonly className?: string | undefined; readonly style?: CSSProperties }) {
  return <div className={`${styles.brick} ${className ?? ""}`} data-item={brick.item ?? undefined} style={style ?? brickStyle(brick.index)}>
    {brick.text && <span className={styles.brickText}>{brick.text}</span>}
    {brick.item && <span className={styles.itemTag}>{BRICK_ITEMS[brick.item].emoji} {BRICK_ITEMS[brick.item].name}</span>}
  </div>;
}

function Hammer({ golden, double }: { readonly golden: boolean; readonly double: boolean }) {
  const head = golden ? ["#fff2a8", "#f6b40e", "#b97400"] : ["#ffffff", "#c9d2ea", "#7d89ad"];
  return <svg viewBox="0 0 200 200" aria-hidden="true">
    <defs>
      <linearGradient id="brick-hammer-head" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={head[0]} /><stop offset=".55" stopColor={head[1]} /><stop offset="1" stopColor={head[2]} />
      </linearGradient>
      <linearGradient id="brick-hammer-handle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#d9884a" /><stop offset=".5" stopColor="#b9622c" /><stop offset="1" stopColor="#8a4519" />
      </linearGradient>
    </defs>
    <rect x="88" y="62" width="26" height="128" rx="12" fill="url(#brick-hammer-handle)" stroke="#1a1238" strokeWidth="6" />
    <path d="M91 150h20M91 164h20M91 178h20" stroke="#6b3412" strokeWidth="5" strokeLinecap="round" />
    <rect x="22" y="18" width="158" height="62" rx="16" fill="url(#brick-hammer-head)" stroke="#1a1238" strokeWidth="7" />
    <rect x="34" y="27" width="70" height="10" rx="5" fill="#fff" opacity=".85" />
    <rect x="10" y="26" width="22" height="46" rx="8" fill={head[2]} stroke="#1a1238" strokeWidth="6" />
    {double && <text x="118" y="62" textAnchor="middle" fontSize="30" fontWeight="900" fill="#ff4d6d" stroke="#1a1238" strokeWidth="2">×2</text>}
  </svg>;
}

export default function BrickStage({ bricks, impact, impacts, golden, double, shielded, onImpactDone }: {
  /** Bottom brick first. */
  readonly bricks: readonly StageBrick[];
  readonly impact: Impact | null;
  readonly impacts: readonly Impact[];
  readonly golden: boolean;
  readonly double: boolean;
  readonly shielded: boolean;
  readonly onImpactDone: (id: number) => void;
}) {
  const stageMotion = !impact ? "" : impact.correct ? styles.shake : impact.protectedMiss ? styles.blocked : styles.recoil;
  return <div className={styles.stageWrap}>
    <div key={`stage-${impact?.id ?? 0}`} className={`${styles.stage} ${stageMotion}`}
      style={{ "--shake": `${Math.min(4 + (impact?.combo ?? 0), 14)}px` } as CSSProperties}>
      <div className={styles.stack} key={bricks[0]?.index ?? 0} data-drop={impact?.correct ?? false}
        style={{ "--drop-count": impact?.correct ? impact.bricks.length : 0 } as CSSProperties}>
        {[...bricks].reverse().map((brick, reversed) => {
          const offset = bricks.length - 1 - reversed;
          return <Brick key={brick.index} brick={brick} className={offset === 0 ? `${styles.current} ${shielded ? styles.shielded : ""}` : styles[`upper${offset}`]} />;
        })}
      </div>
      <div className={styles.pedestal} aria-hidden="true" />
      <div key={`hammer-${impact?.id ?? 0}`} data-golden={golden}
        className={`${styles.hammer} ${impact ? impact.correct || impact.protectedMiss ? styles.swing : styles.bounce : ""}`}>
        <Hammer golden={golden} double={double} />
      </div>
    </div>
    {impacts.map((hit) => <div key={hit.id} className={styles.impact} aria-hidden="true" style={{ "--side": hit.side } as CSSProperties}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) onImpactDone(hit.id); }}>
      {hit.correct ? <>
        {hit.bricks.map((brick, offset) => <Brick key={brick.index} brick={brick} className={`${styles.flying} ${hit.bomb ? styles.exploding : ""}`}
          style={brickStyle(brick.index, { "--offset": offset, "--side": offset % 2 ? -hit.side : hit.side })} />)}
        <div className={styles.ring} />
        <div className={styles.flash} />
        {Array.from({ length: hit.bomb ? 16 : 10 }, (_, i) => <i key={i} className={styles.shard}
          style={brickStyle(hit.bricks[i % hit.bricks.length]?.index ?? 0, { "--i": i, "--n": hit.bomb ? 16 : 10, "--reach": hit.bomb ? 1.7 : 1 })} />)}
        <b className={styles.popText} data-big={hit.bomb || hit.bricks.length > 1}>{hit.bomb ? "콰광!" : hit.bricks.length > 1 ? "파팡!" : "팡!"}</b>
        <b className={styles.plus} data-gold={hit.score > hit.bricks.length}>+{hit.score}</b>
      </> : <>
        <b className={styles.clang} data-blocked={hit.protectedMiss}>{hit.protectedMiss ? "막았다!" : "깡!"}</b>
        <div className={styles.sparks}>{hit.protectedMiss ? "🛡️" : "✦"}</div>
      </>}
    </div>)}
  </div>;
}
