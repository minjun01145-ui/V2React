export interface PendingLogicalOperation<TPayload> {
  readonly operationId: string;
  readonly logicalKey: string;
  readonly baseRevision: number;
  readonly payload: TPayload;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => [key, canonicalValue(entry)]));
}

export function logicalOperationKey(parts: readonly unknown[]): string {
  return JSON.stringify(canonicalValue(parts)) ?? "null";
}

export function beginLogicalOperation<TPayload>(input: {
  readonly pending: PendingLogicalOperation<TPayload> | null;
  readonly logicalKey: string;
  readonly baseRevision: number;
  readonly createPayload: () => TPayload;
  readonly createOperationId?: () => string;
}): PendingLogicalOperation<TPayload> {
  if (input.pending?.logicalKey === input.logicalKey) return input.pending;
  return {
    operationId: (input.createOperationId ?? (() => globalThis.crypto.randomUUID()))(),
    logicalKey: input.logicalKey,
    baseRevision: input.baseRevision,
    payload: input.createPayload(),
  };
}

export function completeLogicalOperation<TPayload>(
  pending: PendingLogicalOperation<TPayload> | null,
  operationId: string,
): PendingLogicalOperation<TPayload> | null {
  return pending?.operationId === operationId ? null : pending;
}

export function reconcileLogicalOperation<TPayload>(
  pending: PendingLogicalOperation<TPayload> | null,
  canonicalRevision: number,
  canonicalOperationId: string | null,
): PendingLogicalOperation<TPayload> | null {
  if (!pending) return null;
  const operationConfirmed = canonicalOperationId === pending.operationId;
  const canonicalProgressAdvanced = canonicalRevision > pending.baseRevision;
  return operationConfirmed || canonicalProgressAdvanced ? null : pending;
}
