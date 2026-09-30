import { useState } from "react";
import type { ChunkLineUpBoard } from "../../multiplayer/chunk-line-up/types.ts";
import { chunkLineUpFloorLabel } from "./layout.ts";
import styles from "./ChunkLineUp.module.css";

interface Props {
  readonly board: ChunkLineUpBoard;
  /** Floor the local player is on; floorCount means the lobby. */
  readonly currentFloor: number;
}

/**
 * The tower no longer fits on one screen, so this directory lists every floor's
 * meaning and chunk progress, and marks where the player is.
 */
export default function ChunkLineUpFloorGuide({ board, currentFloor }: Props) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || window.innerWidth > 760);
  const floorCount = board.groups.length;

  return <aside className={styles.floorGuide} data-open={open}>
    <button type="button" className={styles.floorGuideToggle} onClick={() => setOpen((value) => !value)}>
      {open ? "층 안내 닫기" : "층 안내"}
    </button>
    {open ? <ol>
      {board.groups.map((group, floor) => <li key={group.id} data-current={floor === currentFloor}>
        <b>{chunkLineUpFloorLabel(floor, floorCount)}</b>
        <div>
          <span>{group.prompt.replaceAll("/", " ")}</span>
          <small>
            {group.slots.map((slot) => <i
              key={slot.id}
              data-state={slot.fixed ? "fixed" : slot.filledBy ? "filled" : "empty"}
            >{slot.fixed || slot.filledBy ? slot.text : "?"}</i>)}
          </small>
        </div>
      </li>)}
      <li data-current={currentFloor >= floorCount} data-lobby="true">
        <b>1F</b>
        <div><span>로비 · 엘리베이터 탑승</span></div>
      </li>
    </ol> : null}
  </aside>;
}
