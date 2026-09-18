import { appendMovementSnapshot, sampleMovementTrack, type LiveMovementTrack } from "./core/interpolation.ts";
import type { LiveRemoteFrame, LiveWorldScope } from "./core/types.ts";
import type { LiveMovementObserverConnection, LiveMovementObserverTransport } from "./transport.ts";

export interface LiveMovementObserverOptions {
  readonly interpolationDelayMs?: number;
  readonly maxExtrapolationMs?: number;
  readonly onError?: (error: Error) => void;
}

export class LiveMovementObserver {
  private readonly transport: LiveMovementObserverTransport;
  private readonly interpolationDelayMs: number;
  private readonly maxExtrapolationMs: number;
  private readonly onError: (error: Error) => void;
  private readonly tracks = new Map<string, LiveMovementTrack>();
  private connection: LiveMovementObserverConnection | null = null;
  private closed = false;

  constructor(transport: LiveMovementObserverTransport, options: LiveMovementObserverOptions = {}) {
    this.transport = transport;
    this.interpolationDelayMs = Math.max(0, options.interpolationDelayMs ?? 150);
    this.maxExtrapolationMs = Math.max(0, options.maxExtrapolationMs ?? 180);
    this.onError = options.onError ?? console.error;
  }

  async connect(scope: LiveWorldScope): Promise<void> {
    if (this.connection) throw new Error("Live movement observer is already connected.");
    if (this.closed) throw new Error("Live movement observer has already been closed.");
    this.connection = await this.transport.subscribe(scope, {
      onSnapshot: (snapshot) => {
        const current = this.tracks.get(snapshot.playerId) ?? null;
        this.tracks.set(snapshot.playerId, appendMovementSnapshot(current, snapshot));
      },
      onLeave: (playerId) => {
        this.tracks.delete(playerId);
      },
      onError: this.onError,
    });
  }

  samplePlayers(nowMs = Date.now()): readonly LiveRemoteFrame[] {
    const renderAtMs = nowMs - this.interpolationDelayMs;
    return [...this.tracks.values()].map((track) =>
      sampleMovementTrack(track, renderAtMs, this.maxExtrapolationMs)
    );
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.tracks.clear();
    const connection = this.connection;
    this.connection = null;
    if (connection) await connection.close();
  }
}
