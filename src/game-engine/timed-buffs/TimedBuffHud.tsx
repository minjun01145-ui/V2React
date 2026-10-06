import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { TimedBuffDefinitions } from "./model.ts";
import styles from "./TimedBuffHud.module.css";

const ANNOUNCE_MS = 2_200;

export interface TimedBuffHudItem<Kind extends string> {
  readonly kind: Kind;
  readonly endsAtLocalMs: number;
  readonly stacks?: number;
}

/**
 * Only the player who picked an item sees its banner and countdown.
 * Games restyle it through `className` and the `data-buff-part` attribute.
 */
export default function TimedBuffHud<Kind extends string>({ buffs, definitions, className = "" }: {
  readonly buffs: readonly TimedBuffHudItem<Kind>[];
  readonly definitions: TimedBuffDefinitions<Kind>;
  readonly className?: string | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState<{ readonly kind: Kind; readonly key: number; readonly stacks: number } | null>(null);
  const seenEnds = useRef(new Map<Kind, number>());

  useEffect(() => {
    for (const buff of buffs) {
      if (seenEnds.current.get(buff.kind) === buff.endsAtLocalMs) continue;
      seenEnds.current.set(buff.kind, buff.endsAtLocalMs);
      setAnnouncement({ kind: buff.kind, key: buff.endsAtLocalMs, stacks: buff.stacks ?? 1 });
    }
  }, [buffs]);

  useEffect(() => {
    if (buffs.length === 0) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [buffs.length]);

  useEffect(() => {
    if (!announcement) return undefined;
    const timer = window.setTimeout(() => setAnnouncement(null), ANNOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  const active = buffs.filter((buff) => buff.endsAtLocalMs > now);
  const color = (kind: Kind) => ({ "--buff-color": definitions[kind].color }) as CSSProperties;
  return <>
    {announcement ? <div className={`${styles.buffAnnouncement} ${className}`} data-buff-part="announcement" data-kind={announcement.kind}
      key={announcement.key} role="status" style={color(announcement.kind)}>
      <span>{definitions[announcement.kind].icon}</span>
      <strong>{definitions[announcement.kind].durationMs / 1_000}초간 {definitions[announcement.kind].label}!!{announcement.stacks > 1 ? ` ×${announcement.stacks}` : ""}</strong>
    </div> : null}
    {active.length > 0 ? <div className={`${styles.buffChips} ${className}`} data-buff-part="chips" aria-label="적용 중인 아이템">
      {active.map((buff) => <span key={buff.kind} data-kind={buff.kind} style={color(buff.kind)}>
        {definitions[buff.kind].icon} {definitions[buff.kind].label}{(buff.stacks ?? 1) > 1 ? ` ×${buff.stacks}` : ""} <b>{Math.ceil((buff.endsAtLocalMs - now) / 1_000)}</b>
      </span>)}
    </div> : null}
  </>;
}
