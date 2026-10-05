import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../shared/firebase.js";
import type { TenantId } from "../shared/tenant.js";
import { walletDocument } from "../coins/service.js";
import { parseBalance } from "../coins/model.js";
import { CATALOG, DEFAULT_APPEARANCE, DEFAULT_ITEM_IDS, assertOwnedAppearance, automaticPrice, catalogItem, parseAppearance, parseOwnedItems, parseShopState, publishShop, purchase, selectWeeklyItems, shopWeek, updateOverrides, type Appearance, type ShopState } from "./model.js";

export const wardrobeDocument = (accountId: string) => db.collection("studentGameData").doc(accountId).collection("wardrobe").doc("profile");
const avatarDocument = (accountId: string) => db.collection("studentGameData").doc(accountId).collection("cosmetics").doc("profile");
const shopDocument = (tenantId: TenantId) => db.collection("tenants").doc(tenantId).collection("characterShop").doc("state");
const stamp = () => ({ updatedAt: FieldValue.serverTimestamp(), updatedAtMs: Date.now() });

export async function initializeCharacter(accountId: string): Promise<void> {
  await db.runTransaction(async (tx) => {
    const wardrobeRef = wardrobeDocument(accountId), walletRef = walletDocument(accountId), avatarRef = avatarDocument(accountId);
    const [wardrobe, wallet, avatar] = await Promise.all([tx.get(wardrobeRef), tx.get(walletRef), tx.get(avatarRef)]);
    if (!wardrobe.exists) tx.create(wardrobeRef, { appearance: DEFAULT_APPEARANCE, ownedItemIds: DEFAULT_ITEM_IDS, ...stamp() });
    if (!wallet.exists) tx.create(walletRef, { balance: 0, ...stamp() });
    // Existing student-made characters and captured Pokémon remain selected during migration.
    if (!avatar.exists) tx.create(avatarRef, { equippedKind: "maple", avatar: { kind: "maple", appearance: wardrobe.exists ? parseAppearance(wardrobe.data()?.appearance) : DEFAULT_APPEARANCE }, ...stamp() });
  });
}
export async function ensureShop(tenantId: TenantId): Promise<ShopState> {
  return db.runTransaction(async (tx) => {
    const ref = shopDocument(tenantId);
    const snapshot = await tx.get(ref);
    const previous = snapshot.exists ? parseShopState(snapshot.data()) : null;
    const state = publishShop(previous, shopWeek());
    if (state !== previous) tx.set(ref, { ...state, ...stamp() });
    return state;
  });
}
export function shopResponse(state: ShopState, admin = false) {
  return {
    week: state.week,
    featuredIds: state.featuredIds,
    items: CATALOG.map((item) => ({ ...item, price: state.prices[item.itemId] ?? automaticPrice(item.itemId), onSale: !DEFAULT_ITEM_IDS.includes(item.itemId), isNew: state.featuredIds.includes(item.itemId) })),
    ...(admin ? { next: state.next, nextFeaturedIds: selectWeeklyItems(state.next.week, state.lastFeatured, state.next) } : {}),
  };
}
export async function buyCharacterItem(accountId: string, tenantId: TenantId, itemId: number, expectedPrice: number) {
  if (!catalogItem(itemId) || DEFAULT_ITEM_IDS.includes(itemId)) throw new HttpsError("invalid-argument", "판매 중인 아이템이 아닙니다.");
  await ensureShop(tenantId);
  return db.runTransaction(async (tx) => {
    const wardrobeRef = wardrobeDocument(accountId), walletRef = walletDocument(accountId), shopRef = shopDocument(tenantId);
    const [wardrobe, wallet, shop] = await Promise.all([tx.get(wardrobeRef), tx.get(walletRef), tx.get(shopRef)]);
    const owned = wardrobe.exists ? parseOwnedItems(wardrobe.data()?.ownedItemIds) : [...DEFAULT_ITEM_IDS];
    const balance = wallet.exists ? parseBalance(wallet.data()?.balance) : 0;
    const state = parseShopState(shop.data());
    if (state.week !== shopWeek()) throw new HttpsError("failed-precondition", "주간 상점이 변경되었습니다. 상점을 다시 불러와 주세요.");
    const price = state.prices[itemId] ?? automaticPrice(itemId);
    if (!owned.includes(itemId) && expectedPrice !== price) throw new HttpsError("failed-precondition", "가격이 변경되었습니다. 상점을 다시 불러와 주세요.");
    let result;
    try { result = purchase(balance, owned, itemId, price); }
    catch { throw new HttpsError("failed-precondition", "V2코인이 부족합니다."); }
    if (result.purchased) {
      tx.set(wardrobeRef, { ownedItemIds: result.ownedItemIds, ...(wardrobe.exists ? {} : { appearance: DEFAULT_APPEARANCE }), ...stamp() }, { merge: true });
      tx.set(walletRef, { balance: result.balance, ...stamp() }, { merge: true });
      // Stable item receipt makes a lost response or retry harmless; ownership is permanent.
      tx.create(wardrobeRef.collection("purchases").doc(String(itemId)), { itemId, price, purchasedAt: FieldValue.serverTimestamp() });
    }
    return result;
  });
}
export async function saveCharacter(accountId: string, input: unknown): Promise<Appearance> {
  let appearance: Appearance;
  try { appearance = parseAppearance(input); } catch (error) { throw new HttpsError("invalid-argument", (error as Error).message); }
  await db.runTransaction(async (tx) => {
    const ref = wardrobeDocument(accountId);
    const snapshot = await tx.get(ref);
    const owned = snapshot.exists ? parseOwnedItems(snapshot.data()?.ownedItemIds) : [...DEFAULT_ITEM_IDS];
    try { assertOwnedAppearance(appearance, owned); } catch (error) { throw new HttpsError("failed-precondition", (error as Error).message); }
    tx.set(ref, { appearance, ownedItemIds: owned, ...stamp() }, { merge: true });
    tx.set(avatarDocument(accountId), { equippedKind: "maple", avatar: { kind: "maple", appearance }, ...stamp() });
  });
  return appearance;
}
export async function editNextShop(tenantId: TenantId, week: string, itemId: number, mode: "auto" | "exclude" | "feature", price: number | null) {
  await ensureShop(tenantId);
  const state = await db.runTransaction(async (tx) => {
    const ref = shopDocument(tenantId);
    const snapshot = await tx.get(ref);
    const current = parseShopState(snapshot.data());
    if (current.week !== shopWeek() || current.next.week !== week) throw new HttpsError("failed-precondition", "주간 상점이 변경되었습니다. 다시 불러와 주세요.");
    let next;
    try { next = updateOverrides(current.next, itemId, mode, price); } catch (error) { throw new HttpsError("invalid-argument", (error as Error).message); }
    const updated = { ...current, next };
    tx.set(ref, { ...updated, ...stamp() });
    return updated;
  });
  return shopResponse(state, true);
}
