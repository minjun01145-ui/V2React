import { useState } from "react";
import type { Player } from "../../../multiplayer/types.ts";
import { createLadder, traceLadder } from "../../../student-picker/model.ts";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./LadderPicker.module.css";

export default function LadderPicker({ players }: { readonly players: readonly Player[] }) {
  const [ladder, setLadder] = useState(() => createLadder(players.length));
  const [phase, setPhase] = useState<"ready" | "running" | "done">("ready");
  const [run, setRun] = useState(0);
  const points = traceLadder(ladder);
  const winner = players[points.at(-1)?.column ?? -1];
  const columnWidth = 80;
  const x = (column: number): number => columnWidth / 2 + column * columnWidth;
  const y = (level: number): number => 45 + level * 22;
  const bottom = y(ladder.rows.length + 1);
  const width = Math.max(columnWidth, ladder.count * columnWidth);
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.column)} ${y(point.level)}`).join(" ");

  const prepare = (): void => {
    setLadder(createLadder(players.length));
    setPhase("ready");
    setRun((value) => value + 1);
  };

  return <section className={styles.panel} aria-label="사다리타기">
    <div className={styles.actions}>
      <Button onClick={() => setPhase("running")} disabled={phase !== "ready" || players.length === 0}>{players.length === 0 ? "학생 접속 대기 중" : phase === "running" ? "사다리 타는 중…" : phase === "done" ? "뽑기 완료" : "사다리타기"}</Button>
      <Button variant="ghost" onClick={prepare} disabled={phase === "running" || players.length === 0}>다시 준비</Button>
    </div>
    {players.length === 0 ? <p>접속한 학생이 없습니다.</p> : <div className={styles.scroll}>
      <svg className={styles.ladder} viewBox={`0 0 ${width} ${bottom + 68}`} style={{ width }} role="img" aria-label={`사다리 ${players.length}명${phase === "done" && winner ? `, 당첨 ${winner.studentNumber}번 ${winner.displayName}` : ""}`}>
        {players.map((player, column) => <g key={player.id}>
          <text x={x(column)} y={25} className={column === ladder.start ? styles.winningStart : styles.start}>{column === ladder.start ? "O" : "X"}</text>
          <line x1={x(column)} y1={45} x2={x(column)} y2={bottom} className={styles.rail} />
          <text x={x(column)} y={bottom + 28} className={styles.name}>{player.studentNumber}번</text>
          <text x={x(column)} y={bottom + 48} className={styles.name}>{player.displayName.length > 7 ? `${player.displayName.slice(0, 6)}…` : player.displayName}<title>{player.displayName}</title></text>
        </g>)}
        {ladder.rows.flatMap((bridges, row) => bridges.map((column) => <line key={`${row}-${column}`} x1={x(column)} y1={y(row + 1)} x2={x(column + 1)} y2={y(row + 1)} className={styles.rail} />))}
        {phase !== "ready" ? <path key={run} d={path} pathLength={1} className={`${styles.path} ${phase === "running" ? styles.running : ""}`} onAnimationEnd={() => setPhase("done")} /> : null}
      </svg>
    </div>}
    <div className={styles.result} role="status">{phase === "done" && winner ? `${winner.studentNumber}번 ${winner.displayName}` : ""}</div>
  </section>;
}
