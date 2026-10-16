import type { AttractorHazard } from "../maps/types.ts";

export interface AttractedBody {
  readonly center: { readonly x: number; readonly y: number };
  readonly velocity: { x: number; y: number };
}

/** A finite, weak pull within the influence radius; the event horizon itself is fatal. */
export function applyAttractor(hole: AttractorHazard, body: AttractedBody, deltaMs: number): boolean {
  const dx = hole.x - body.center.x;
  const dy = hole.y - body.center.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= hole.coreRadius) return true;
  if (distance >= hole.radius) return false;
  const impulse = hole.acceleration * (1 - distance / hole.radius) * deltaMs / 1_000;
  body.velocity.x += dx / distance * impulse;
  body.velocity.y += dy / distance * impulse;
  return false;
}
