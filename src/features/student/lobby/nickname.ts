export { displayLabel } from "../../../multiplayer/types.ts";

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 12;

export function normalizeNickname(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function validateNickname(value: string | null | undefined): string | null {
  const nickname = normalizeNickname(value);
  if (!nickname) return null;
  if (nickname.length < NICKNAME_MIN_LENGTH) return `닉네임은 ${NICKNAME_MIN_LENGTH}글자 이상 입력해 주세요.`;
  if (nickname.length > NICKNAME_MAX_LENGTH) return `닉네임은 ${NICKNAME_MAX_LENGTH}글자 이하로 입력해 주세요.`;
  return null;
}