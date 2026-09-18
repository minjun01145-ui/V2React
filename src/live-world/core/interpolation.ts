import type { LiveMovementSnapshot, LiveRemoteFrame } from "./types.ts";

export interface LiveMovementTrack {
  readonly previous: LiveMovementSnapshot | null;
  readonly latest: LiveMovementSnapshot;
}

export function appendMovementSnapshot(
  track: LiveMovementTrack | null,
  snapshot: LiveMovementSnapshot,
): LiveMovementTrack {
  if (!track) return { previous: null, latest: snapshot };
  if (snapshot.sequence <= track.latest.sequence) return track;
  return { previous: track.latest, latest: snapshot };
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
  const { previous, latest } = track;
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
