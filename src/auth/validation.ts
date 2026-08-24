export function normalizeStudentNumber(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

export function normalizePersonName(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function validateStudentCredentials(studentNumber: unknown, name: unknown): {
  readonly studentNumber: string;
  readonly name: string;
} {
  const normalizedNumber = normalizeStudentNumber(studentNumber);
  const normalizedName = normalizePersonName(name);

  if (!/^[0-9]{1,12}$/.test(normalizedNumber)) {
    throw new Error("학번은 숫자로 입력해 주세요.");
  }
  if (normalizedName.length < 1 || normalizedName.length > 30) {
    throw new Error("이름을 정확히 입력해 주세요.");
  }
  return { studentNumber: normalizedNumber, name: normalizedName };
}

export function validateStudentPin(value: unknown): string {
  const pin = String(value ?? "").normalize("NFKC").trim();
  if (!/^[0-9]{4}$/.test(pin)) throw new Error("비밀번호는 숫자 4자리로 입력해 주세요.");
  return pin;
}
