export const TEACHER_VIEW = Object.freeze({
  LOBBY: "lobby",
  STUDENTS: "students",
  OPINIONS: "opinions",
  SETS: "sets",
  SLIDE_SHOW: "slide-show",
  SETTINGS: "settings",
} as const);

export type TeacherView = typeof TEACHER_VIEW[keyof typeof TEACHER_VIEW];

const allowedViews = new Set<TeacherView>(Object.values(TEACHER_VIEW));

export function getTeacherView(hash: string = window.location.hash): TeacherView {
  const raw = hash.replace(/^#\/?/, "").split(/[/?]/, 1)[0] ?? "";
  if (raw === "ai") return TEACHER_VIEW.SETTINGS;
  return allowedViews.has(raw as TeacherView) ? raw as TeacherView : TEACHER_VIEW.LOBBY;
}

export function teacherHref(view: TeacherView): string {
  return `#/${view}`;
}

export type SettingsSection = "general" | "ai" | "fonts";

export function getSettingsSection(hash: string = window.location.hash): SettingsSection {
  const [view, section] = hash.replace(/^#\/?/, "").split(/[/?]/);
  if (view === "ai" || (view === "settings" && section === "ai")) return "ai";
  return view === "settings" && section === "fonts" ? "fonts" : "general";
}
