import { AVATAR_CATEGORIES, type AvatarCategory, type CharacterAppearance } from "./appearance.ts";

// Fixed region/version keeps old item IDs reproducible. API docs: https://maplestory.io/swagger/V3/swagger.json
export const MAPLE_API = "https://maplestory.io/api/GMS/214";
export function mapleItemIconUrl(itemId: number): string { return `${MAPLE_API}/item/${itemId}/icon`; }
export function mapleCharacterUrl(appearance: CharacterAppearance): string {
  const items = AVATAR_CATEGORIES.map((category) => appearance.items[category]).filter((id) => id !== null).join(",");
  return `${MAPLE_API}/Character/compact/${appearance.skinId}/${items}/stand1/0`;
}
export function previewCharacterItem(appearance: CharacterAppearance, category: AvatarCategory, itemId: number | null): CharacterAppearance {
  return { ...appearance, items: { ...appearance.items, [category]: itemId } };
}
