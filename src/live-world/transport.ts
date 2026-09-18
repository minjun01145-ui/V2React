import type { LiveMovementSnapshot, LiveMovementUpdate, LiveWorldScope } from "./core/types.ts";

export interface LiveMovementTransportHandlers {
  readonly onSnapshot: (snapshot: LiveMovementSnapshot) => void;
  readonly onLeave: (playerId: string) => void;
  readonly onError?: (error: Error) => void;
}

export interface LiveMovementConnection {
  publish(update: LiveMovementUpdate): Promise<void>;
  close(): Promise<void>;
}

export interface LiveMovementTransport {
  connect(
    scope: LiveWorldScope,
    playerId: string,
    handlers: LiveMovementTransportHandlers,
  ): Promise<LiveMovementConnection>;
}
