export interface CharacterCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly creator: string;
  readonly standFrames: readonly [string, string, string, string];
}

const standFrameModules = import.meta.glob(
  "../assets/characters/*/stand1_[0-3].png",
  { eager: true, query: "?url&no-inline", import: "default" },
) as Readonly<Record<string, string>>;

const LEGACY_CHARACTER_IDS: Readonly<Record<string, string>> = Object.freeze({
  "두수ver.1(민정원)": "dusoo-v1",
  "다이노사우르스(여채원)": "dinosaur",
});

function splitFolderName(folderName: string): { readonly name: string; readonly creator: string } {
  const match = /^(.*)\(([^()]*)\)$/.exec(folderName);
  if (!match) return { name: folderName.trim(), creator: "이름 미상" };
  return {
    name: (match[1] ?? folderName).trim(),
    creator: (match[2] ?? "이름 미상").trim(),
  };
}

function buildCatalog(): readonly CharacterCatalogItem[] {
  const framesByFolder = new Map<string, Array<string | undefined>>();
  for (const [path, source] of Object.entries(standFrameModules)) {
    const match = /[/\\]characters[/\\]([^/\\]+)[/\\]stand1_([0-3])\.png$/.exec(path);
    if (!match) continue;
    const folderName = match[1];
    const frameIndex = Number(match[2]);
    if (!folderName || !Number.isInteger(frameIndex)) continue;
    const frames = framesByFolder.get(folderName) ?? new Array<string | undefined>(4);
    frames[frameIndex] = source;
    framesByFolder.set(folderName, frames);
  }

  return [...framesByFolder.entries()]
    .flatMap(([folderName, frames]) => {
      const [frame0, frame1, frame2, frame3] = frames;
      if (!frame0 || !frame1 || !frame2 || !frame3) return [];
      const { name, creator } = splitFolderName(folderName);
      return [{
        id: LEGACY_CHARACTER_IDS[folderName] ?? folderName,
        name,
        creator,
        standFrames: [frame0, frame1, frame2, frame3] as const,
      }];
    })
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

export const CHARACTER_CATALOG: readonly CharacterCatalogItem[] = Object.freeze(buildCatalog());
export const CHARACTER_IDS = CHARACTER_CATALOG.map((character) => character.id);

export function findCharacter(characterId: string | null): CharacterCatalogItem | null {
  return CHARACTER_CATALOG.find((character) => character.id === characterId) ?? null;
}

export function isCharacterId(value: unknown): value is string {
  return typeof value === "string" && CHARACTER_IDS.includes(value);
}
