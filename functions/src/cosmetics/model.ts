import { MAPLE_CATALOG } from "./catalog.js";
import { isRecord } from "../shared/validation.js";

export const CATEGORIES = ["hair", "face", "hat", "top", "bottom", "shoes", "accessory", "weapon"] as const;
export type Category = typeof CATEGORIES[number];
export interface Appearance {
  readonly version: 1;
  readonly skinId: 2000;
  readonly items: Readonly<Record<Category, number | null>>;
}
export const DEFAULT_APPEARANCE: Appearance = {
  version: 1, skinId: 2000,
  items: { hair: 30000, face: 20000, hat: null, top: 1040002, bottom: 1060002, shoes: 1072001, accessory: null, weapon: null },
};
export const DEFAULT_ITEM_IDS = Object.values(DEFAULT_APPEARANCE.items).filter((id): id is number => id !== null);
const defaults = [
  { itemId: 30000, name: "기본 헤어", category: "hair" }, { itemId: 20000, name: "기본 얼굴", category: "face" },
  { itemId: 1040002, name: "기본 상의", category: "top" }, { itemId: 1060002, name: "기본 하의", category: "bottom" },
  { itemId: 1072001, name: "기본 신발", category: "shoes" },
] as const;
export const CATALOG: readonly { readonly itemId: number; readonly name: string; readonly category: Category }[] = [
  ...defaults, ...MAPLE_CATALOG.filter((item) => !DEFAULT_ITEM_IDS.includes(item.itemId)),
];
const byId = new Map(CATALOG.map((item) => [item.itemId, item]));
export function catalogItem(itemId: number) { return byId.get(itemId); }
export function isCategory(value: unknown): value is Category { return CATEGORIES.includes(value as Category); }
export function automaticPrice(itemId: number): number {
  const item = byId.get(itemId);
  if (!item) throw new Error("등록되지 않은 아이템입니다.");
  if (DEFAULT_ITEM_IDS.includes(itemId)) return 0;
  const base: Record<Category, number> = { hair: 40, face: 30, hat: 10, top: 20, bottom: 20, shoes: 10, accessory: 20, weapon: 30 };
  return base[item.category] + (itemId % 3) * 10;
}
export function parseAppearance(value: unknown): Appearance {
  if (!isRecord(value) || value.version !== 1 || value.skinId !== 2000 || !isRecord(value.items)
    || Object.keys(value.items).length !== CATEGORIES.length) throw new Error("캐릭터 설정이 올바르지 않습니다.");
  const items = {} as Record<Category, number | null>;
  for (const category of CATEGORIES) {
    const id = value.items[category];
    if (id === null && ["hat", "accessory", "weapon"].includes(category)) { items[category] = null; continue; }
    if (typeof id !== "number" || !Number.isSafeInteger(id) || byId.get(id)?.category !== category) {
      throw new Error("캐릭터 아이템 종류가 올바르지 않습니다.");
    }
    items[category] = id;
  }
  return { version: 1, skinId: 2000, items };
}
export function parseOwnedItems(value: unknown): number[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "number" || !byId.has(id))) {
    throw new Error("보유 아이템을 확인할 수 없습니다.");
  }
  return [...new Set([...DEFAULT_ITEM_IDS, ...value])];
}
export function parseBalance(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("V2코인 잔액을 확인할 수 없습니다.");
  return value;
}
export function purchase(balance: number, owned: readonly number[], itemId: number, price: number) {
  if (owned.includes(itemId)) return { balance, ownedItemIds: [...owned], purchased: false };
  if (balance < price) throw new Error("V2코인이 부족합니다.");
  return { balance: balance - price, ownedItemIds: [...owned, itemId], purchased: true };
}
export function assertOwnedAppearance(appearance: Appearance, owned: readonly number[]): void {
  if (Object.values(appearance.items).some((id) => id !== null && !owned.includes(id))) throw new Error("미보유 아이템을 먼저 구매해 주세요.");
}

const WEEK_MS = 7 * 86_400_000;
// Monday 00:00 Asia/Seoul, represented as a date key in that timezone.
export function shopWeek(now = Date.now()): string {
  const local = new Date(now + 9 * 3_600_000);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - (local.getUTCDay() + 6) % 7);
  return new Date(monday).toISOString().slice(0, 10);
}
export function nextShopWeek(week: string): string { return new Date(Date.parse(`${week}T00:00:00Z`) + WEEK_MS).toISOString().slice(0, 10); }
export interface WeekOverrides { readonly week: string; readonly excludedIds: readonly number[]; readonly forcedIds: readonly number[]; readonly prices: Readonly<Record<string, number>> }
export interface ShopState {
  readonly week: string;
  readonly featuredIds: readonly number[];
  readonly lastFeatured: Readonly<Record<string, string>>;
  readonly prices: Readonly<Record<string, number>>;
  readonly next: WeekOverrides;
}
export function parseShopState(value: unknown): ShopState {
  const date = (input: unknown): input is string => typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input) && Number.isFinite(Date.parse(input));
  const ids = (input: unknown): input is number[] => Array.isArray(input) && input.every((id) => typeof id === "number" && byId.has(id) && !DEFAULT_ITEM_IDS.includes(id));
  const prices = (input: unknown): input is Record<string, number> => isRecord(input) && Object.entries(input).every(([id, price]) => byId.has(Number(id)) && typeof price === "number" && Number.isSafeInteger(price) && price >= 1 && price <= 10_000);
  if (!isRecord(value) || !date(value.week) || !ids(value.featuredIds) || !isRecord(value.lastFeatured)
    || Object.entries(value.lastFeatured).some(([id, week]) => !byId.has(Number(id)) || !date(week)) || !prices(value.prices)
    || !isRecord(value.next) || value.next.week !== nextShopWeek(value.week) || !ids(value.next.excludedIds)
    || !ids(value.next.forcedIds) || value.next.forcedIds.length > 10 || !prices(value.next.prices)) throw new Error("주간 상점 데이터를 확인할 수 없습니다.");
  return { week: value.week, featuredIds: value.featuredIds, lastFeatured: value.lastFeatured as Record<string, string>, prices: value.prices,
    next: { week: value.next.week, excludedIds: value.next.excludedIds, forcedIds: value.next.forcedIds, prices: value.next.prices } };
}
export function emptyOverrides(week: string): WeekOverrides { return { week, excludedIds: [], forcedIds: [], prices: {} }; }
function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function selectWeeklyItems(week: string, history: Readonly<Record<string, string>>, overrides: WeekOverrides): number[] {
  const available = CATALOG.filter((item) => !DEFAULT_ITEM_IDS.includes(item.itemId) && !overrides.excludedIds.includes(item.itemId));
  const selected = overrides.forcedIds.filter((id) => available.some((item) => item.itemId === id));
  const candidates = [...available].sort((a, b) => (history[a.itemId] ?? "").localeCompare(history[b.itemId] ?? "")
    || hash(`${week}:${a.itemId}`) - hash(`${week}:${b.itemId}`));
  for (const category of CATEGORIES) {
    if (selected.length >= 8) break;
    if (selected.some((id) => byId.get(id)?.category === category)) continue;
    const candidate = candidates.find((item) => item.category === category && !selected.includes(item.itemId));
    if (candidate) selected.push(candidate.itemId);
  }
  for (const item of candidates) {
    if (selected.length >= 8) break;
    if (!selected.includes(item.itemId)) selected.push(item.itemId);
  }
  return selected;
}
export function publishShop(previous: ShopState | null, week: string): ShopState {
  if (previous?.week === week) return previous;
  const overrides = previous?.next.week === week ? previous.next : emptyOverrides(week);
  const history = { ...previous?.lastFeatured };
  const featuredIds = selectWeeklyItems(week, history, overrides);
  for (const id of featuredIds) history[id] = week;
  // Price edits remain effective even if no one opened the shop during a missed scheduled week.
  const duePrices = previous && previous.next.week <= week ? previous.next.prices : {};
  return { week, featuredIds, lastFeatured: history, prices: { ...previous?.prices, ...duePrices }, next: emptyOverrides(nextShopWeek(week)) };
}
export function updateOverrides(next: WeekOverrides, itemId: number, mode: "auto" | "exclude" | "feature", price: number | null): WeekOverrides {
  if (!byId.has(itemId) || DEFAULT_ITEM_IDS.includes(itemId)) throw new Error("판매 아이템을 선택해 주세요.");
  const forcedIds = next.forcedIds.filter((id) => id !== itemId);
  const excludedIds = next.excludedIds.filter((id) => id !== itemId);
  if (mode === "feature") forcedIds.push(itemId);
  if (mode === "exclude") excludedIds.push(itemId);
  if (forcedIds.length > 10) throw new Error("신상은 최대 10개까지 지정할 수 있습니다.");
  const prices = { ...next.prices };
  if (price === null) delete prices[itemId]; else prices[itemId] = price;
  return { ...next, forcedIds, excludedIds, prices };
}
