import type { Player } from "./types.ts";

function presenceKey(player: Player): string {
  return player.studentNumber.normalize("NFKC").trim();
}

function isFresher(candidate: Player, current: Player): boolean {
  if (candidate.lastSeenAtMs !== current.lastSeenAtMs) return candidate.lastSeenAtMs > current.lastSeenAtMs;
  if (candidate.joinedAtMs !== current.joinedAtMs) return candidate.joinedAtMs > current.joinedAtMs;
  return candidate.id.localeCompare(current.id) > 0;
}

export function deduplicatePlayers(players: readonly Player[]): Player[] {
  const currentByStudent = new Map<string, Player>();
  for (const player of players) {
    const key = presenceKey(player);
    const current = currentByStudent.get(key);
    if (!current || isFresher(player, current)) currentByStudent.set(key, player);
  }
  return [...currentByStudent.values()].sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, "ko-KR", { numeric: true }));
}

export function isPlayerOnline(player: Player, now: number, staleAfterMs: number): boolean {
  return player.lastSeenAtMs > 0 && now - player.lastSeenAtMs <= staleAfterMs;
}

export function selectActivePlayers(
  players: readonly Player[],
  now: number,
  staleAfterMs: number,
): Player[] {
  return deduplicatePlayers(players.filter((player) => isPlayerOnline(player, now, staleAfterMs)));
}

