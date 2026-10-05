export function parseBalance(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error("V2코인 잔액을 확인할 수 없습니다.");
  return value;
}
