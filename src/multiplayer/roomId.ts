const ROOM_ID_MAX_LENGTH = 64;
const ALLOWED_ROOM_CHARS = /[^\p{L}\p{N}._-]+/gu;

export function normalizeRoomId(value: unknown, fallback = "main-class"): string {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "-")
    .replace(ALLOWED_ROOM_CHARS, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, ROOM_ID_MAX_LENGTH);
  return normalized || fallback;
}
