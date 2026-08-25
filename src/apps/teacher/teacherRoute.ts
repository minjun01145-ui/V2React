export const TEACHER_VIEW = Object.freeze({
  DASHBOARD: "dashboard",
  LOBBY: "lobby",
  STUDENTS: "students",
  SETS: "sets",
  AI: "ai",
  TEST_TOOL: "test-tool",
  SETTINGS: "settings",
} as const);

export type TeacherView = typeof TEACHER_VIEW[keyof typeof TEACHER_VIEW];

const allowedViews = new Set<TeacherView>(Object.values(TEACHER_VIEW));

export function getTeacherView(hash: string = window.location.hash): TeacherView {
  const raw = hash.replace(/^#\/?/, "").split(/[/?]/, 1)[0] ?? "";
  return allowedViews.has(raw as TeacherView) ? raw as TeacherView : TEACHER_VIEW.DASHBOARD;
}

export function teacherHref(view: TeacherView): string {
  return `#/${view}`;
}
