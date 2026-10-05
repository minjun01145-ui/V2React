export const AVATAR_CATEGORIES = ["hair", "face", "hat", "top", "bottom", "shoes", "accessory", "weapon"] as const;
export type AvatarCategory = typeof AVATAR_CATEGORIES[number];
export const CATEGORY_LABELS: Record<AvatarCategory, string> = { hair: "헤어", face: "얼굴", hat: "모자", top: "상의", bottom: "하의", shoes: "신발", accessory: "액세서리", weapon: "무기" };
export interface CharacterAppearance {
  readonly version: 1;
  readonly skinId: 2000;
  readonly items: Readonly<Record<AvatarCategory, number | null>>;
}
export const DEFAULT_CHARACTER_APPEARANCE: CharacterAppearance = {
  version: 1, skinId: 2000,
  items: { hair: 30000, face: 20000, hat: null, top: 1040002, bottom: 1060002, shoes: 1072001, accessory: null, weapon: null },
};
export interface MapleAvatar { readonly kind: "maple"; readonly appearance: CharacterAppearance }
export function itemMatchesCategory(id: number, category: AvatarCategory): boolean {
  if (!Number.isSafeInteger(id)) return false;
  switch (category) {
    case "hair": return id >= 30000 && id < 50000;
    case "face": return id >= 20000 && id < 30000;
    case "hat": return id >= 1000000 && id < 1010000;
    case "top": return id >= 1040000 && id < 1050000;
    case "bottom": return id >= 1060000 && id < 1070000;
    case "shoes": return id >= 1070000 && id < 1080000;
    case "accessory": return id >= 1010000 && id < 1020000;
    case "weapon": return id >= 1300000 && id < 1310000;
  }
}
export function parseCharacterAppearance(value: unknown): CharacterAppearance | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || raw.skinId !== 2000 || typeof raw.items !== "object" || raw.items === null || Array.isArray(raw.items)) return null;
  const input = raw.items as Record<string, unknown>;
  if (Object.keys(input).length !== AVATAR_CATEGORIES.length) return null;
  const items = {} as Record<AvatarCategory, number | null>;
  for (const category of AVATAR_CATEGORIES) {
    const id = input[category];
    if (id === null && ["hat", "accessory", "weapon"].includes(category)) items[category] = null;
    else if (typeof id === "number" && itemMatchesCategory(id, category)) items[category] = id;
    else return null;
  }
  return { version: 1, skinId: 2000, items };
}
