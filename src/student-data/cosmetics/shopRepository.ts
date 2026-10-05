import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { db, functions } from "../../firebase/firebaseClient.ts";
import { AVATAR_CATEGORIES, itemMatchesCategory, parseCharacterAppearance, type AvatarCategory, type CharacterAppearance } from "../../characters/appearance.ts";
import type { StudentWardrobe } from "./types.ts";

export interface CharacterShopItem {
  readonly itemId: number;
  readonly name: string;
  readonly category: AvatarCategory;
  readonly price: number;
  readonly onSale: boolean;
  readonly isNew: boolean;
}
export interface CharacterShopData { readonly week: string; readonly featuredIds: readonly number[]; readonly items: readonly CharacterShopItem[] }
export interface NextShopOverrides { readonly week: string; readonly excludedIds: readonly number[]; readonly forcedIds: readonly number[]; readonly prices: Readonly<Record<string, number>> }
export interface NextCharacterShopData extends CharacterShopData { readonly next: NextShopOverrides; readonly nextFeaturedIds: readonly number[] }
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
function numberList(value: unknown): number[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "number" || !Number.isSafeInteger(id) || id < 1)) throw new Error("아이템 목록을 확인하지 못했습니다.");
  return value;
}
export function parseCharacterShop(value: unknown): CharacterShopData {
  if (!record(value) || typeof value.week !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.week) || !Array.isArray(value.items)) throw new Error("상점을 불러오지 못했습니다.");
  const items = value.items.map((item): CharacterShopItem => {
    if (!record(item) || typeof item.itemId !== "number" || typeof item.name !== "string" || !item.name.trim()
      || !AVATAR_CATEGORIES.includes(item.category as AvatarCategory) || !itemMatchesCategory(item.itemId, item.category as AvatarCategory)
      || typeof item.price !== "number" || !Number.isSafeInteger(item.price) || item.price < 0
      || typeof item.onSale !== "boolean" || typeof item.isNew !== "boolean") throw new Error("상점 아이템을 확인하지 못했습니다.");
    return { itemId: item.itemId, name: item.name, category: item.category as AvatarCategory, price: item.price, onSale: item.onSale, isNew: item.isNew };
  });
  const featuredIds = numberList(value.featuredIds);
  if (featuredIds.some((id) => !items.some((item) => item.itemId === id))) throw new Error("이번 주 신상을 확인하지 못했습니다.");
  return { week: value.week, featuredIds, items };
}
export function parseNextCharacterShop(value: unknown): NextCharacterShopData {
  const shop = parseCharacterShop(value);
  if (!record(value) || !record(value.next) || typeof value.next.week !== "string" || !record(value.next.prices)
    || Object.values(value.next.prices).some((price) => typeof price !== "number" || !Number.isSafeInteger(price) || price < 1 || price > 10_000)) throw new Error("다음 주 신상을 확인하지 못했습니다.");
  return { ...shop, next: { week: value.next.week, excludedIds: numberList(value.next.excludedIds), forcedIds: numberList(value.next.forcedIds), prices: value.next.prices as Record<string, number> }, nextFeaturedIds: numberList(value.nextFeaturedIds) };
}
export async function initializeStudentCharacter(): Promise<void> { await httpsCallable(functions, "initializeStudentCharacter")(); }
export async function loadCharacterShop(): Promise<CharacterShopData> {
  return parseCharacterShop((await httpsCallable<undefined, unknown>(functions, "getCharacterShop")()).data);
}
export async function purchaseCharacterItem(item: CharacterShopItem): Promise<{ readonly balance: number; readonly ownedItemIds: readonly number[]; readonly purchased: boolean }> {
  const result = await httpsCallable<{ itemId: number; expectedPrice: number }, unknown>(functions, "purchaseCharacterItem")({ itemId: item.itemId, expectedPrice: item.price });
  const data = result.data;
  if (!record(data) || typeof data.balance !== "number" || !Number.isSafeInteger(data.balance) || data.balance < 0 || typeof data.purchased !== "boolean") throw new Error("구매 결과를 확인하지 못했습니다. 상점을 다시 열어 주세요.");
  return { balance: data.balance, ownedItemIds: numberList(data.ownedItemIds), purchased: data.purchased };
}
export async function saveStudentCharacter(appearance: CharacterAppearance): Promise<void> {
  await httpsCallable(functions, "saveStudentCharacter")({ appearance });
}
export function subscribeStudentWardrobe(accountId: string, onValue: (value: StudentWardrobe) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, "studentGameData", accountId, "wardrobe", "profile"), (snapshot) => {
    try {
      const data: unknown = snapshot.data();
      const appearance = parseCharacterAppearance(record(data) ? data.appearance : null);
      if (!appearance || !record(data)) throw new Error("캐릭터 정보를 확인하지 못했습니다.");
      onValue({ appearance, ownedItemIds: numberList(data.ownedItemIds) });
    } catch (error) { onError(error as Error); }
  }, onError);
}
export function subscribeV2Coins(accountId: string, onValue: (balance: number) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(doc(db, "studentGameData", accountId, "wallet", "v2coins"), (snapshot) => {
    const balance: unknown = snapshot.data()?.balance;
    if (typeof balance !== "number" || !Number.isSafeInteger(balance) || balance < 0) { onError(new Error("V2코인 잔액을 확인하지 못했습니다.")); return; }
    onValue(balance);
  }, onError);
}
export async function loadNextCharacterShop(): Promise<NextCharacterShopData> {
  return parseNextCharacterShop((await httpsCallable<undefined, unknown>(functions, "getNextCharacterShop")()).data);
}
export async function updateNextCharacterShop(week: string, itemId: number, mode: "auto" | "exclude" | "feature", price: number | null): Promise<NextCharacterShopData> {
  return parseNextCharacterShop((await httpsCallable(functions, "updateNextCharacterShop")({ week, itemId, mode, price })).data);
}
