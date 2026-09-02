import { auth } from "../../firebase/firebaseClient.ts";
import { ensurePokemonCatchData, subscribeCapturedPokemon, subscribePokemonInventory } from "./repository.ts";
import { EMPTY_POKEMON_INVENTORY, type PokemonInventory, type StoredCapturedPokemon } from "./types.ts";

export interface PokemonCatchSnapshot {
  readonly inventory: PokemonInventory;
  readonly captures: readonly StoredCapturedPokemon[];
  readonly loading: boolean;
  readonly error: Error | null;
}

type Listener = (snapshot: PokemonCatchSnapshot) => void;

interface Channel {
  readonly listeners: Set<Listener>;
  snapshot: PokemonCatchSnapshot;
  initialized: boolean;
  inventoryReady: boolean;
  capturesReady: boolean;
  readonly stop: () => void;
  idleTimer: ReturnType<typeof globalThis.setTimeout> | null;
}

const channels = new Map<string, Channel>();
const IDLE_GRACE_MS = 15_000;

function notify(channel: Channel): void {
  channel.snapshot = {
    ...channel.snapshot,
    loading: channel.snapshot.error ? false : !(channel.initialized && channel.inventoryReady && channel.capturesReady),
  };
  for (const listener of channel.listeners) listener(channel.snapshot);
}

function ensureChannel(accountId: string): Channel {
  const existing = channels.get(accountId);
  if (existing) return existing;
  let stopInventory = (): void => undefined;
  let stopCaptures = (): void => undefined;
  const channel: Channel = {
    listeners: new Set(),
    snapshot: { inventory: EMPTY_POKEMON_INVENTORY, captures: [], loading: true, error: null },
    initialized: false,
    inventoryReady: false,
    capturesReady: false,
    stop: () => { stopInventory(); stopCaptures(); },
    idleTimer: null,
  };
  channels.set(accountId, channel);
  void ensurePokemonCatchData(accountId).then(() => {
    channel.initialized = true;
    notify(channel);
  }).catch((error: unknown) => {
    channel.snapshot = { ...channel.snapshot, loading: false, error: error instanceof Error ? error : new Error(String(error)) };
    notify(channel);
  });
  stopInventory = subscribePokemonInventory(accountId, (inventory) => {
    channel.inventoryReady = true;
    channel.snapshot = { ...channel.snapshot, inventory };
    notify(channel);
  }, (error) => {
    channel.snapshot = { ...channel.snapshot, loading: false, error };
    notify(channel);
  });
  stopCaptures = subscribeCapturedPokemon(accountId, (captures) => {
    channel.capturesReady = true;
    channel.snapshot = { ...channel.snapshot, captures };
    notify(channel);
  }, (error) => {
    channel.snapshot = { ...channel.snapshot, loading: false, error };
    notify(channel);
  });
  return channel;
}

export async function pokemonCatchAccountId(uid: string, studentNumber: string): Promise<string> {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("학생 계정 인증 정보를 확인하지 못했습니다.");
  const token = await user.getIdTokenResult();
  return token.claims.role === "test-student" ? `test-${uid}` : studentNumber;
}

export function subscribeSharedPokemonCatchData(accountId: string, listener: Listener): () => void {
  const channel = ensureChannel(accountId);
  if (channel.idleTimer !== null) {
    globalThis.clearTimeout(channel.idleTimer);
    channel.idleTimer = null;
  }
  channel.listeners.add(listener);
  listener(channel.snapshot);
  return () => {
    channel.listeners.delete(listener);
    if (channel.listeners.size > 0 || channel.idleTimer !== null) return;
    channel.idleTimer = globalThis.setTimeout(() => {
      if (channel.listeners.size > 0) return;
      channel.stop();
      channels.delete(accountId);
    }, IDLE_GRACE_MS);
  };
}

export function warmPokemonCatchData(accountId: string): Promise<() => void> {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    let settled = false;
    unsubscribe = subscribeSharedPokemonCatchData(accountId, (snapshot) => {
      if (snapshot.loading || settled) return;
      settled = true;
      if (snapshot.error) {
        queueMicrotask(() => unsubscribe?.());
        reject(snapshot.error);
      } else {
        resolve(() => unsubscribe?.());
      }
    });
  });
}
