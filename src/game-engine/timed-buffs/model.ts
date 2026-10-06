/**
 * In-game items that grant a timed effect. Each game decides how items appear
 * and what they do; this module only knows how long each pickup lasts and how
 * pickups of the same kind add up.
 */

export interface TimedBuffDefinition {
  readonly label: string;
  readonly icon: string;
  readonly durationMs: number;
  /** CSS background for the banner and chip (a colour or a gradient). */
  readonly color: string;
}

export type TimedBuffDefinitions<Kind extends string> = Readonly<Record<Kind, TimedBuffDefinition>>;

export interface TimedBuffPickup<Kind extends string> {
  readonly kind: Kind;
  readonly atMs: number;
}

export interface ActiveTimedBuff<Kind extends string> {
  readonly kind: Kind;
  /** End time on this device's clock (Date.now), ready for UI countdowns. */
  readonly endsAtLocalMs: number;
  /** Unexpired pickups of this kind; games that do not stack can ignore it. */
  readonly stacks: number;
}

/** Every pickup lasts its kind's duration; the kind stays active until its latest pickup ends. */
export function activeTimedBuffs<Kind extends string>(
  pickups: readonly TimedBuffPickup<Kind>[],
  durationOf: (kind: Kind) => number,
  nowMs: number,
): ActiveTimedBuff<Kind>[] {
  const active = new Map<Kind, ActiveTimedBuff<Kind>>();
  for (const pickup of pickups) {
    const endsAtLocalMs = pickup.atMs + durationOf(pickup.kind);
    if (endsAtLocalMs <= nowMs) continue;
    const previous = active.get(pickup.kind);
    active.set(pickup.kind, {
      kind: pickup.kind,
      endsAtLocalMs: Math.max(previous?.endsAtLocalMs ?? 0, endsAtLocalMs),
      stacks: (previous?.stacks ?? 0) + 1,
    });
  }
  return [...active.values()];
}
