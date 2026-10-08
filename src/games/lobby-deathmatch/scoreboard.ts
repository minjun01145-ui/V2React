import type { LiveRecord } from "../../live-world/client.ts";

export interface DeathmatchRow {
  readonly playerId: string;
  readonly label: string;
  readonly kills: number;
  readonly deaths: number;
}

/** Kills and deaths live on two record boards; rank by kills, then fewer deaths. */
export function deathmatchScoreboard(kills: readonly LiveRecord[], deaths: readonly LiveRecord[]): DeathmatchRow[] {
  const rows = new Map<string, DeathmatchRow>();
  for (const record of kills) rows.set(record.playerId, { playerId: record.playerId, label: record.label, kills: record.score, deaths: 0 });
  for (const record of deaths) {
    const row = rows.get(record.playerId);
    rows.set(record.playerId, row ? { ...row, deaths: record.score } : { playerId: record.playerId, label: record.label, kills: 0, deaths: record.score });
  }
  return [...rows.values()].sort((left, right) => right.kills - left.kills || left.deaths - right.deaths || left.label.localeCompare(right.label, "ko-KR"));
}
