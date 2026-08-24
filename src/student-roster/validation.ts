import { validateStudentCredentials } from "../auth/validation.ts";
import type { StudentRosterInput } from "./types.ts";

export function parseRosterPaste(value: string): readonly StudentRosterInput[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 1) throw new Error("붙여넣을 학생 명단을 입력해 주세요.");
  if (lines.length > 200) throw new Error("한 번에 최대 200명까지 등록할 수 있습니다.");

  const students = lines.map((line, index) => {
    const columns = line.split(/[\t,]/).map((column) => column.trim());
    const studentNumber = columns[0] ?? "";
    const name = columns.slice(1).join(" ");
    try {
      return { ...validateStudentCredentials(studentNumber, name), active: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "형식을 확인해 주세요.";
      throw new Error(`${index + 1}번째 줄: ${message}`);
    }
  });

  return [...new Map(students.map((student) => [student.studentNumber, student])).values()];
}
