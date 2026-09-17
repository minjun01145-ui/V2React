export type TeacherBgmMode = "lobby" | "game";

export interface TeacherBgmCatalog {
  readonly lobby: readonly string[];
  readonly game: readonly string[];
}

interface IndexedTrack {
  readonly index: number;
  readonly url: string;
}

const BGM_FILENAME = /\/(lobby|game)(\d+)\.mp3$/i;

export function buildTeacherBgmCatalog(files: Readonly<Record<string, string>>): TeacherBgmCatalog {
  const tracks: Record<TeacherBgmMode, IndexedTrack[]> = { lobby: [], game: [] };

  for (const [path, url] of Object.entries(files)) {
    const match = BGM_FILENAME.exec(path);
    if (!match) continue;
    const mode = match[1]?.toLowerCase();
    const index = Number(match[2]);
    if ((mode !== "lobby" && mode !== "game") || !Number.isSafeInteger(index)) continue;
    tracks[mode].push({ index, url });
  }

  const orderedUrls = (items: readonly IndexedTrack[]): readonly string[] =>
    [...items].sort((left, right) => left.index - right.index).map((item) => item.url);

  return {
    lobby: orderedUrls(tracks.lobby),
    game: orderedUrls(tracks.game),
  };
}

export function pickRandomTrack(
  tracks: readonly string[],
  random: () => number = Math.random,
): string | null {
  if (tracks.length === 0) return null;
  const index = Math.min(Math.floor(random() * tracks.length), tracks.length - 1);
  return tracks[index] ?? null;
}
