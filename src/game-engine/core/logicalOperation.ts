export interface PendingLogicalOperation<TPayload> {
  readonly operationId: string;
  readonly logicalKey: string;
  readonly payload: TPayload;
}

export class LogicalOperationConflictError extends Error {
  constructor() {
    super("이전 결과 저장을 먼저 확인하거나 다시 시도해 주세요.");
    this.name = "LogicalOperationConflictError";
  }
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
  readonly createPayload: () => TPayload;
  readonly createOperationId?: () => string;
}): PendingLogicalOperation<TPayload> {
  if (input.pending) {
    if (input.pending.logicalKey === input.logicalKey) return input.pending;
    throw new LogicalOperationConflictError();
  }
  return {
    operationId: (input.createOperationId ?? (() => globalThis.crypto.randomUUID()))(),
    logicalKey: input.logicalKey,
    payload: input.createPayload(),
  };
}

export function completeLogicalOperation<TPayload>(
  pending: PendingLogicalOperation<TPayload> | null,
  operationId: string,
): PendingLogicalOperation<TPayload> | null {
  return pending?.operationId === operationId ? null : pending;
}
