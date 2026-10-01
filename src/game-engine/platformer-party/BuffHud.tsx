import { useEffect, useRef, useState } from "react";
import { BUFF_DURATION_MS, ITEM_LABEL, ITEM_STYLE, type ActiveBuff, type PartyItemKind } from "./buffs.ts";
import styles from "./BuffHud.module.css";

const ANNOUNCE_MS = 2_200;

/** Only the player who picked an item sees its banner and countdown. */
export default function BuffHud({ buffs }: { readonly buffs: readonly ActiveBuff[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState<{ readonly kind: PartyItemKind; readonly key: number } | null>(null);
  const seenEnds = useRef(new Map<PartyItemKind, number>());

  useEffect(() => {
    for (const buff of buffs) {
      if (seenEnds.current.get(buff.kind) === buff.endsAtLocalMs) continue;
      seenEnds.current.set(buff.kind, buff.endsAtLocalMs);
      setAnnouncement({ kind: buff.kind, key: buff.endsAtLocalMs });
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
  return <>
    {announcement ? <div className={styles.buffAnnouncement} data-kind={announcement.kind} key={announcement.key} role="status">
      <span>{ITEM_STYLE[announcement.kind].icon}</span>
      <strong>{BUFF_DURATION_MS / 1_000}초간 {ITEM_LABEL[announcement.kind]}!!</strong>
    </div> : null}
    {active.length > 0 ? <div className={styles.buffChips} aria-label="적용 중인 아이템">
      {active.map((buff) => <span key={buff.kind} data-kind={buff.kind}>
        {ITEM_STYLE[buff.kind].icon} {ITEM_LABEL[buff.kind]} <b>{Math.ceil((buff.endsAtLocalMs - now) / 1_000)}</b>
      </span>)}
    </div> : null}
  </>;
}
