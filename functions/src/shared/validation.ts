import { HttpsError } from "firebase-functions/v2/https";

export interface StudentCredentials {
  readonly studentNumber: string;
  readonly name: string;
}

export interface RosterInput extends StudentCredentials {
  readonly active: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeStudentNumber(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

export function normalizePersonName(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function parseStudentCredentials(value: unknown): StudentCredentials {
  if (!isRecord(value)) throw new HttpsError("invalid-argument", "학번과 이름을 확인해주세요.");
  const studentNumber = normalizeStudentNumber(value.studentNumber);
  const name = normalizePersonName(value.name);
  if (!/^[0-9]{1,12}$/.test(studentNumber) || name.length < 1 || name.length > 30) {
    throw new HttpsError("invalid-argument", "학번과 이름을 확인해주세요.");
  }
  return { studentNumber, name };
}

export function parsePin(value: unknown): string {
  const pin = String(value ?? "").normalize("NFKC").trim();
  if (!/^[0-9]{4}$/.test(pin)) throw new HttpsError("invalid-argument", "비밀번호는 숫자 4자리로 입력해주세요.");
  return pin;
}

export function parseRosterInput(value: unknown): RosterInput {
  const credentials = parseStudentCredentials(value);
  const active = !isRecord(value) || value.active !== false;
  return { ...credentials, active };
}
