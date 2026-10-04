export function pickStudentIndex(count: number, random: () => number = Math.random): number {
  return count === 0 ? -1 : Math.floor(random() * count);
}

export interface Ladder {
  readonly count: number;
  readonly rows: readonly (readonly number[])[];
  readonly start: number;
}

/** Each row contains disjoint bridges between adjacent columns. */
export function createLadder(count: number, random: () => number = Math.random): Ladder {
  const rows = Array.from({ length: 12 }, () => {
    const bridges: number[] = [];
    for (let column = 0; column < count - 1; column++) {
      if (random() < 0.45) {
        bridges.push(column);
        column++;
      }
    }
    return bridges;
  });
  return { count, rows, start: pickStudentIndex(count, random) };
}

export interface LadderPoint { readonly column: number; readonly level: number }

/** The winner is determined by following the drawn bridges, never by a separate draw. */
export function traceLadder(ladder: Ladder): readonly LadderPoint[] {
  if (ladder.start < 0) return [];
  let column = ladder.start;
  const points: LadderPoint[] = [{ column, level: 0 }];
  ladder.rows.forEach((bridges, index) => {
    const level = index + 1;
    points.push({ column, level });
    if (bridges.includes(column)) column++;
    else if (bridges.includes(column - 1)) column--;
    points.push({ column, level });
  });
  points.push({ column, level: ladder.rows.length + 1 });
  return points;
}
