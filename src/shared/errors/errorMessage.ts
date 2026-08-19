export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  return new Error("알 수 없는 오류가 발생했습니다.");
}

export function toErrorMessage(value: unknown, fallback = "알 수 없는 오류가 발생했습니다."): string {
  if (value instanceof Error && value.message) return value.message;
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}
