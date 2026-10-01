import { getDatabase, onValue, ref, type Unsubscribe } from "firebase/database";
import { firebaseApp } from "../firebase/firebaseClient.ts";
import { createFirebaseRealtimeMovementObserverTransport, createFirebaseRealtimeMovementTransport } from "./firebaseRealtimeTransport.ts";
import { LiveMovementEngine, type LiveMovementEngineOptions } from "./LiveMovementEngine.ts";
import { LiveMovementObserver, type LiveMovementObserverOptions } from "./LiveMovementObserver.ts";
import { currentTenantConfig } from "../tenant/config.ts";
import { connectLiveClaims, type LiveClaim, type LiveClaims } from "./claims.ts";
import type { LiveWorldScope } from "./core/types.ts";
import { connectLiveEvents, type LiveEvent, type LiveEventChannel } from "./events.ts";

export type { LiveClaim, LiveClaims, LiveEvent, LiveEventChannel };

function realtimeDatabase() {
  return getDatabase(firebaseApp);
}

export function createLiveMovementEngine(playerId: string, options?: LiveMovementEngineOptions): LiveMovementEngine {
  return new LiveMovementEngine(playerId, createFirebaseRealtimeMovementTransport(realtimeDatabase(), currentTenantConfig().id), options);
}

export function createLiveMovementObserver(options?: LiveMovementObserverOptions): LiveMovementObserver {
  return new LiveMovementObserver(createFirebaseRealtimeMovementObserverTransport(realtimeDatabase(), currentTenantConfig().id), options);
}

export function createLiveEventChannel(
  scope: LiveWorldScope,
  playerId: string | null,
  onEvent: (event: LiveEvent) => void,
  onError: (error: Error) => void,
): LiveEventChannel {
  return connectLiveEvents(realtimeDatabase(), currentTenantConfig().id, scope, playerId, onEvent, onError);
}

export function createLiveClaims(
  scope: LiveWorldScope,
  playerId: string | null,
  onClaim: (claim: LiveClaim) => void,
  onError: (error: Error) => void,
): LiveClaims {
  return connectLiveClaims(realtimeDatabase(), currentTenantConfig().id, scope, playerId, onClaim, onError);
}

export function subscribeLiveServerTimeOffset(
  onOffset: (offsetMs: number) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onValue(
    ref(realtimeDatabase(), ".info/serverTimeOffset"),
    (snapshot) => {
      const value: unknown = snapshot.val();
      onOffset(typeof value === "number" && Number.isFinite(value) ? value : 0);
    },
    (error) => onError?.(error),
  );
}
