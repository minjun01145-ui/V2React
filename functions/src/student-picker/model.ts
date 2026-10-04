import { isRecord } from "../shared/validation.js";

export class StudentPickError extends Error {}

export interface PickDate { readonly date: string; readonly month: number; readonly day: number }

export function getPickDate(now: Date = new Date()): PickDate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string): string => parts.find((item) => item.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, month: Number(part("month")), day: Number(part("day")) };
}

export interface PickCandidate {
  readonly id: string;
  readonly studentNumber: string;
  readonly lastSeenAtMs: number;
  readonly joinedAtMs: number;
}

/** Matches the lobby's 30-second presence window and one connection per student. */
export function activePickCandidates(entries: readonly { readonly id: string; readonly data: unknown }[], now: number): PickCandidate[] {
  const students = new Map<string, PickCandidate>();
  for (const entry of entries) {
    const raw = entry.data;
    if (!isRecord(raw) || typeof raw.studentNumber !== "string" || !/^[0-9]{1,12}$/.test(raw.studentNumber)
      || typeof raw.lastSeenAtMs !== "number" || !Number.isFinite(raw.lastSeenAtMs) || raw.lastSeenAtMs <= 0 || now - raw.lastSeenAtMs > 30_000
      || typeof raw.joinedAtMs !== "number" || !Number.isFinite(raw.joinedAtMs)) continue;
    const candidate = { id: entry.id, studentNumber: raw.studentNumber, lastSeenAtMs: raw.lastSeenAtMs, joinedAtMs: raw.joinedAtMs };
    const current = students.get(candidate.studentNumber);
    if (!current || candidate.lastSeenAtMs > current.lastSeenAtMs
      || (candidate.lastSeenAtMs === current.lastSeenAtMs && (candidate.joinedAtMs > current.joinedAtMs
        || (candidate.joinedAtMs === current.joinedAtMs && candidate.id.localeCompare(current.id) > 0)))) students.set(candidate.studentNumber, candidate);
  }
  return [...students.values()].sort((a, b) => a.studentNumber.localeCompare(b.studentNumber, "ko-KR", { numeric: true }));
}

interface DateCalculation {
  readonly title: string;
  readonly value: number;
  readonly lines: readonly string[];
}

/** Interpret a bounded list of arithmetic operations; AI text is never executable code. */
export function parseDateCalculation(reply: string, date: PickDate): DateCalculation {
  let raw: unknown;
  try { raw = JSON.parse(reply.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")); }
  catch { throw new StudentPickError("AI가 올바른 계산을 만들지 못했습니다. 다시 뽑아 주세요."); }
  if (!isRecord(raw) || typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 100
    || !Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 6) throw new StudentPickError("AI 계산 형식을 확인하지 못했습니다. 다시 뽑아 주세요.");
  let value = date.month;
  let usedDay = false;
  const lines: string[] = [];
  for (const step of raw.steps) {
    if (!isRecord(step) || typeof step.reason !== "string" || !step.reason.trim() || step.reason.length > 100) throw new StudentPickError("AI 계산 설명을 확인하지 못했습니다.");
    const operand = step.operand === "month" ? date.month : step.operand === "day" ? date.day : step.operand;
    if (typeof operand !== "number" || !Number.isInteger(operand) || Math.abs(operand) > 1000) throw new StudentPickError("AI 계산의 숫자 범위를 확인하지 못했습니다.");
    const before = value;
    let symbol: string;
    switch (step.operator) {
      case "add": value += operand; symbol = "+"; break;
      case "subtract": value -= operand; symbol = "−"; break;
      case "multiply": value *= operand; symbol = "×"; break;
      case "divide": value /= operand; symbol = "÷"; break;
      case "remainder": value %= operand; symbol = "%"; break;
      default: throw new StudentPickError("AI가 지원하지 않는 계산을 만들었습니다.");
    }
    if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000) throw new StudentPickError("AI 계산 범위를 벗어났습니다. 다시 뽑아 주세요.");
    usedDay ||= step.operand === "day";
    lines.push(`${step.reason.trim()}: ${before} ${symbol} ${operand} = ${value}`);
  }
  if (!usedDay) throw new StudentPickError("AI 계산에 오늘 날짜가 빠졌습니다. 다시 뽑아 주세요.");
  return { title: raw.title.trim(), value, lines };
}

export function resolveDatePick(calculation: DateCalculation, candidates: readonly PickCandidate[], date: PickDate) {
  if (candidates.length === 0) throw new StudentPickError("접속한 학생이 없습니다.");
  const integer = Math.floor(Math.abs(calculation.value));
  const index = integer % candidates.length;
  const student = candidates[index]!;
  return {
    playerId: student.id,
    studentNumber: student.studentNumber,
    date: date.date,
    title: calculation.title,
    calculation: [...calculation.lines, `|${calculation.value}|의 정수 부분 ${integer} % ${candidates.length} + 1 = ${index + 1}번째`, `접속 학생을 번호순으로 세면 ${index + 1}번째는 ${student.studentNumber}번!`],
  };
}
