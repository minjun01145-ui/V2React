import type { PopupInputField, PopupInputValues } from "./types.ts";

export function createPopupInputValues(fields: readonly PopupInputField[]): PopupInputValues {
  return Object.fromEntries(fields.map((field) => [field.name, field.initialValue ?? ""]));
}

export function validatePopupInputValues(fields: readonly PopupInputField[], values: PopupInputValues): string | null {
  const names = new Set<string>();
  for (const field of fields) {
    const name = field.name.trim();
    if (!name || names.has(name)) return "입력 항목 구성이 올바르지 않습니다.";
    names.add(name);
    const value = values[name] ?? "";
    if ((field.required ?? true) && !value.trim()) return `${field.label} 항목을 입력해 주세요.`;
    if (field.maxLength !== undefined && value.length > field.maxLength) return `${field.label} 항목은 ${field.maxLength}자 이하로 입력해 주세요.`;
    if (field.pattern && value && !new RegExp(`^(?:${field.pattern})$`, "u").test(value)) return `${field.label} 입력 형식을 확인해 주세요.`;
    const customError = field.validate?.(value, values) ?? null;
    if (customError) return customError;
  }
  return null;
}
