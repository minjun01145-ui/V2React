import { appendMovementSnapshot, sampleMovementTrack, type LiveMovementTrack } from "./core/interpolation.ts";
import type { LiveMovementState, LiveRemoteFrame, LiveWorldScope } from "./core/types.ts";
import type { LiveMovementConnection, LiveMovementTransport } from "./transport.ts";

const SEQUENCE_RESTART_GAP = 1_000_000;
let lastSequenceBase = 0;

function nextSequenceBase(): number {
  const wallClockBase = Math.floor(Date.now() * 1_000);
  lastSequenceBase = Math.max(wallClockBase, lastSequenceBase + SEQUENCE_RESTART_GAP);
  return lastSequenceBase;
}

export interface LiveMovementEngineOptions {
  /** Network publish rate. Rendering remains independent and can run at 60 fps. */
  readonly sendHz?: number;
  /** Render remote players slightly in the past so two network samples can be interpolated. */
  readonly interpolationDelayMs?: number;
  /** Short extrapolation hides one late packet without letting a remote player drift indefinitely. */
  readonly maxExtrapolationMs?: number;
  readonly onError?: (error: Error) => void;
}

function finiteState(state: LiveMovementState): LiveMovementState {
  if (![state.x, state.y, state.vx, state.vy].every(Number.isFinite)) {
    throw new Error("Live movement state must contain finite coordinates and velocities.");
  }
  return { x: state.x, y: state.y, vx: state.vx, vy: state.vy };
}

function sameState(left: LiveMovementState | null, right: LiveMovementState): boolean {
  return left !== null
    && left.x === right.x
    && left.y === right.y
    && left.vx === right.vx
    && left.vy === right.vy;
}

export class LiveMovementEngine {
  private readonly playerId: string;
  private readonly transport: LiveMovementTransport;
  private readonly sendIntervalMs: number;
  private readonly interpolationDelayMs: number;
  private readonly maxExtrapolationMs: number;
  private readonly onError: (error: Error) => void;
  private readonly tracks = new Map<string, LiveMovementTrack>();

  private connection: LiveMovementConnection | null = null;
  private sequence = nextSequenceBase();
  private pendingState: LiveMovementState | null = null;
  private lastQueuedState: LiveMovementState | null = null;
  private nextPublishAtMs = 0;
  private publishTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private publishing = false;
  private closed = false;

  constructor(playerId: string, transport: LiveMovementTransport, options: LiveMovementEngineOptions = {}) {
    if (!playerId.trim()) throw new Error("Live movement playerId is required.");
    const sendHz = options.sendHz ?? 8;
    if (!Number.isFinite(sendHz) || sendHz < 1 || sendHz > 20) {
      throw new Error("Live movement sendHz must be between 1 and 20.");
    }

    this.playerId = playerId;
    this.transport = transport;
    this.sendIntervalMs = 1_000 / sendHz;
    this.interpolationDelayMs = Math.max(0, options.interpolationDelayMs ?? 150);
    this.maxExtrapolationMs = Math.max(0, options.maxExtrapolationMs ?? 180);
    this.onError = options.onError ?? console.error;
  }

  async connect(scope: LiveWorldScope, initialState: LiveMovementState): Promise<void> {
    if (this.connection) throw new Error("Live movement engine is already connected.");
    if (this.closed) throw new Error("Live movement engine has already been closed.");

    const connection = await this.transport.connect(scope, this.playerId, {
      onSnapshot: (snapshot) => {
        if (snapshot.playerId === this.playerId) return;
        const current = this.tracks.get(snapshot.playerId) ?? null;
        this.tracks.set(snapshot.playerId, appendMovementSnapshot(current, snapshot));
      },
      onLeave: (playerId) => {
        this.tracks.delete(playerId);
      },
      onError: this.onError,
    });
    this.connection = connection;

    const firstState = finiteState(initialState);
    this.lastQueuedState = firstState;
    this.sequence += 1;
    await connection.publish({ sequence: this.sequence, state: firstState });
    this.nextPublishAtMs = Date.now() + this.sendIntervalMs;
  }

  updateLocal(state: LiveMovementState): void {
    if (!this.connection || this.closed) return;
    const next = finiteState(state);
    if (sameState(this.lastQueuedState, next)) return;

    this.lastQueuedState = next;
    this.pendingState = next;
    this.schedulePublish();
  }

  sampleRemotePlayers(nowMs = Date.now()): readonly LiveRemoteFrame[] {
    const renderAtMs = nowMs - this.interpolationDelayMs;
    return [...this.tracks.values()].map((track) =>
      sampleMovementTrack(track, renderAtMs, this.maxExtrapolationMs)
    );
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.publishTimer !== null) {
      globalThis.clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }
    this.pendingState = null;
    this.tracks.clear();
    const connection = this.connection;
    this.connection = null;
    if (connection) await connection.close();
  }

  private schedulePublish(): void {
    if (this.publishTimer !== null || this.publishing || !this.pendingState || !this.connection) return;
    const delayMs = Math.max(0, this.nextPublishAtMs - Date.now());
    this.publishTimer = globalThis.setTimeout(() => {
      this.publishTimer = null;
      void this.flushPending();
    }, delayMs);
  }

  private async flushPending(): Promise<void> {
    if (this.publishing || this.closed || !this.connection || !this.pendingState) return;
    const state = this.pendingState;
    this.pendingState = null;
    this.publishing = true;
    this.sequence += 1;
    this.nextPublishAtMs = Date.now() + this.sendIntervalMs;

    try {
      await this.connection.publish({ sequence: this.sequence, state });
    } catch (reason: unknown) {
      this.onError(reason instanceof Error ? reason : new Error("Live movement publish failed."));
    } finally {
      this.publishing = false;
      this.schedulePublish();
    }
  }
}
