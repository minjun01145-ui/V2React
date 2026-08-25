import type { MultiplayerTestStudentCredential } from "./types.ts";

export type TestStudentMoveDirection = "previous" | "next";

export function selectTestStudentSlot(
  currentSlot: number,
  requestedSlot: number,
  students: readonly MultiplayerTestStudentCredential[],
): number {
  return students.some((student) => student.slot === requestedSlot) ? requestedSlot : currentSlot;
}

export function moveTestStudentSlot(
  currentSlot: number,
  direction: TestStudentMoveDirection,
  students: readonly MultiplayerTestStudentCredential[],
): number {
  if (students.length === 0) return currentSlot;
  const currentIndex = students.findIndex((student) => student.slot === currentSlot);
  const normalizedIndex = currentIndex < 0 ? 0 : currentIndex;
  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (normalizedIndex + offset + students.length) % students.length;
  return students[nextIndex]?.slot ?? currentSlot;
}
