import type { LiveMovementSnapshot, LiveRemoteFrame } from "./types.ts";

export interface LiveMovementTrack {
  readonly latest: LiveMovementSnapshot;
  readonly snapshots: readonly LiveMovementSnapshot[];
}

export function appendMovementSnapshot(
  track: LiveMovementTrack | null,
  snapshot: LiveMovementSnapshot,
): LiveMovementTrack {
  if (!track) return { latest: snapshot, snapshots: [snapshot] };
  if (snapshot.sequence <= track.latest.sequence) return track;
  // Two samples cannot cover a delay longer than one publish interval. Keep a
  // bounded history so a newly arrived packet does not move the render window.
  const snapshots = track.snapshots.filter((item) => item.sentAtMs < snapshot.sentAtMs).slice(-31);
  return { latest: snapshot, snapshots: [...snapshots, snapshot] };
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function frame(
  snapshot: LiveMovementSnapshot,
  x = snapshot.state.x,
  y = snapshot.state.y,
): LiveRemoteFrame {
  return {
    playerId: snapshot.playerId,
    sequence: snapshot.sequence,
    x,
    y,
    vx: snapshot.state.vx,
    vy: snapshot.state.vy,
  };
}

export function sampleMovementTrack(
  track: LiveMovementTrack,
  renderAtMs: number,
  maxExtrapolationMs: number,
): LiveRemoteFrame {
  const first = track.snapshots[0]!;
  if (renderAtMs <= first.sentAtMs) return frame(first);
  const upperIndex = track.snapshots.findIndex((snapshot) => snapshot.sentAtMs >= renderAtMs);
  const latest = upperIndex >= 0 ? track.snapshots[upperIndex]! : track.latest;
  const previous = upperIndex > 0 ? track.snapshots[upperIndex - 1]! : null;
  if (!previous || latest.sentAtMs <= previous.sentAtMs) {
    const aheadMs = Math.max(0, Math.min(maxExtrapolationMs, renderAtMs - latest.sentAtMs));
    return frame(
      latest,
      latest.state.x + latest.state.vx * (aheadMs / 1_000),
      latest.state.y + latest.state.vy * (aheadMs / 1_000),
    );
  }

  if (renderAtMs <= previous.sentAtMs) return frame(previous);

  if (renderAtMs < latest.sentAtMs) {
    const amount = (renderAtMs - previous.sentAtMs) / (latest.sentAtMs - previous.sentAtMs);
    return {
      playerId: latest.playerId,
      sequence: latest.sequence,
      x: lerp(previous.state.x, latest.state.x, amount),
      y: lerp(previous.state.y, latest.state.y, amount),
      vx: lerp(previous.state.vx, latest.state.vx, amount),
      vy: lerp(previous.state.vy, latest.state.vy, amount),
    };
  }

  const aheadMs = Math.min(maxExtrapolationMs, renderAtMs - latest.sentAtMs);
  return frame(
    latest,
    latest.state.x + latest.state.vx * (aheadMs / 1_000),
    latest.state.y + latest.state.vy * (aheadMs / 1_000),
  );
}
