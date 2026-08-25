import { collection, doc, onSnapshot, runTransaction, serverTimestamp, setDoc, type DocumentData, type Unsubscribe } from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { EMPTY_POKEMON_INVENTORY, NEW_PLAYER_POKEMON_INVENTORY, type PokemonInventory, type PokemonItemId, type StoredCapturedPokemon } from "./types.ts";

const gameDocument = (accountId: string) => doc(db, "studentGameData", accountId, "games", "pokemon-catch");
const capturesCollection = (accountId: string) => collection(gameDocument(accountId), "captured");

function count(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function parseInventory(data: DocumentData | undefined): PokemonInventory {
  const inventory = data?.inventory;
  if (typeof inventory !== "object" || inventory === null || Array.isArray(inventory)) return EMPTY_POKEMON_INVENTORY;
  const raw = inventory as Record<string, unknown>;
  return {
    pokeBall: count(raw.pokeBall),
    greatBall: count(raw.greatBall),
    sleepSpray: count(raw.sleepSpray),
    anger: count(raw.anger),
  };
}

function parseCapture(id: string, data: DocumentData): StoredCapturedPokemon | null {
  const speciesId = count(data.speciesId);
  const name = typeof data.name === "string" ? data.name : "";
  const spriteUrl = typeof data.spriteUrl === "string" ? data.spriteUrl : "";
  if (!speciesId || !name || !spriteUrl) return null;
  return {
    captureId: id,
    speciesId,
    name,
    spriteUrl,
    fallbackSpriteUrl: typeof data.fallbackSpriteUrl === "string" ? data.fallbackSpriteUrl : null,
    caughtAtMs: count(data.caughtAtMs),
  };
}

export async function ensurePokemonCatchData(accountId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = gameDocument(accountId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) {
      transaction.set(ref, { inventory: NEW_PLAYER_POKEMON_INVENTORY, updatedAt: serverTimestamp(), updatedAtMs: Date.now() });
    }
  });
}

export function subscribePokemonInventory(accountId: string, onValue: (inventory: PokemonInventory) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(gameDocument(accountId), (snapshot) => onValue(parseInventory(snapshot.data())), onError);
}

export function subscribeCapturedPokemon(accountId: string, onValue: (captures: StoredCapturedPokemon[]) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(capturesCollection(accountId), (snapshot) => {
    const captures = snapshot.docs
      .map((capture) => parseCapture(capture.id, capture.data()))
      .filter((capture): capture is StoredCapturedPokemon => capture !== null)
      .sort((left, right) => right.caughtAtMs - left.caughtAtMs);
    onValue(captures);
  }, onError);
}

export async function addPokemonItem(accountId: string, itemId: PokemonItemId): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = gameDocument(accountId);
    const snapshot = await transaction.get(ref);
    const inventory = snapshot.exists() ? parseInventory(snapshot.data()) : NEW_PLAYER_POKEMON_INVENTORY;
    transaction.set(ref, {
      inventory: { ...inventory, [itemId]: inventory[itemId] + 1 },
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true });
  });
}

export async function consumePokemonItem(accountId: string, itemId: PokemonItemId): Promise<boolean> {
  return runTransaction(db, async (transaction) => {
    const ref = gameDocument(accountId);
    const snapshot = await transaction.get(ref);
    const inventory = snapshot.exists() ? parseInventory(snapshot.data()) : NEW_PLAYER_POKEMON_INVENTORY;
    if (inventory[itemId] < 1) return false;
    transaction.set(ref, {
      inventory: { ...inventory, [itemId]: inventory[itemId] - 1 },
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: true });
    return true;
  });
}

export async function saveCapturedPokemon(accountId: string, capture: StoredCapturedPokemon): Promise<void> {
  await setDoc(doc(capturesCollection(accountId), capture.captureId), {
    speciesId: capture.speciesId,
    name: capture.name,
    spriteUrl: capture.spriteUrl,
    fallbackSpriteUrl: capture.fallbackSpriteUrl,
    caughtAt: serverTimestamp(),
    caughtAtMs: capture.caughtAtMs,
  });
}
