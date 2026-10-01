import { useEffect, useRef, useState } from "react";
import { BUFF_DURATION_MS, ITEM_LABEL, type ChunkLineUpItemKind } from "./items.ts";
import type { ActiveBuff } from "./scene/PowerUpLayer.ts";
import styles from "./ChunkLineUp.module.css";

const ICON: Readonly<Record<ChunkLineUpItemKind, string>> = { speed: "⚡", jump: "⤒", punch: "✊" };
const ANNOUNCE_MS = 2_200;

/** Only the player who picked an item sees its banner and countdown. */
export default function ChunkLineUpBuffHud({ buffs }: { readonly buffs: readonly ActiveBuff[] }) {
  const [now, setNow] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState<{ readonly kind: ChunkLineUpItemKind; readonly key: number } | null>(null);
  const seenEnds = useRef(new Map<ChunkLineUpItemKind, number>());

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
      <span>{ICON[announcement.kind]}</span>
      <strong>{BUFF_DURATION_MS / 1_000}초간 {ITEM_LABEL[announcement.kind]}!!</strong>
    </div> : null}
    {active.length > 0 ? <div className={styles.buffChips} aria-label="적용 중인 아이템">
      {active.map((buff) => <span key={buff.kind} data-kind={buff.kind}>
        {ICON[buff.kind]} {ITEM_LABEL[buff.kind]} <b>{Math.ceil((buff.endsAtLocalMs - now) / 1_000)}</b>
      </span>)}
    </div> : null}
  </>;
}
