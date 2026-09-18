import { getDatabase } from "firebase/database";
import { firebaseApp } from "../firebase/firebaseClient.ts";
import { createFirebaseRealtimeMovementObserverTransport, createFirebaseRealtimeMovementTransport } from "./firebaseRealtimeTransport.ts";
import { LiveMovementEngine, type LiveMovementEngineOptions } from "./LiveMovementEngine.ts";
import { LiveMovementObserver, type LiveMovementObserverOptions } from "./LiveMovementObserver.ts";

function realtimeDatabase() {
  return getDatabase(firebaseApp);
}

export function createLiveMovementEngine(playerId: string, options?: LiveMovementEngineOptions): LiveMovementEngine {
  return new LiveMovementEngine(playerId, createFirebaseRealtimeMovementTransport(realtimeDatabase()), options);
}

export function createLiveMovementObserver(options?: LiveMovementObserverOptions): LiveMovementObserver {
  return new LiveMovementObserver(createFirebaseRealtimeMovementObserverTransport(realtimeDatabase()), options);
}
