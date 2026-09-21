export interface PracticeRecord {
  readonly accountId: string;
  readonly nickname: string;
  readonly classroom: string;
  readonly averageCpm: number;
  readonly bestCpm: number;
  readonly completedAt: number;
}

export function practiceMonth(now: number): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

export function classroomLabel(studentNumber: string): string {
  return /^[1-6]\d{4}$/.test(studentNumber)
    ? `${studentNumber[0]}학년 ${Number(studentNumber.slice(1, 3))}반`
    : "학반 미등록";
}

export function rankPracticeRecords(records: readonly PracticeRecord[], candidate: PracticeRecord): PracticeRecord[] {
  const previous = records.find((record) => record.accountId === candidate.accountId);
  const compare = (a: PracticeRecord, b: PracticeRecord) => b.averageCpm - a.averageCpm
    || b.bestCpm - a.bestCpm || a.completedAt - b.completedAt;
  const best = previous && compare(previous, candidate) <= 0 ? previous : candidate;
  return [...records.filter((record) => record.accountId !== candidate.accountId), best].sort(compare).slice(0, 10);
}
