import { useEffect, useState } from "react";
import { getRoomIdFromLocation } from "../../app/location.ts";
import { signOutAdmin } from "../../auth/teacherAuth.ts";
import TeacherAiPage from "../../features/teacher/ai/TeacherAiPage.tsx";
import TeacherDashboardPage from "../../features/teacher/dashboard/TeacherDashboardPage.tsx";
import TeacherLobbyPage from "../../features/teacher/lobby/TeacherLobbyPage.tsx";
import TeacherSetsPage from "../../features/teacher/sets/TeacherSetsPage.tsx";
import TeacherSettingsPage from "../../features/teacher/settings/TeacherSettingsPage.tsx";
import TeacherStudentsPage from "../../features/teacher/students/TeacherStudentsPage.tsx";
import TeacherNav from "./TeacherNav.tsx";
import { getTeacherView, TEACHER_VIEW, type TeacherView } from "./teacherRoute.ts";

export default function TeacherWorkspace() {
  const [view, setView] = useState<TeacherView>(getTeacherView);
  const roomId = getRoomIdFromLocation();

  useEffect(() => {
    const handleHashChange = (): void => setView(getTeacherView());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <>
      <TeacherNav currentView={view} roomId={roomId} onLogout={signOutAdmin} />
      {view === TEACHER_VIEW.LOBBY ? <TeacherLobbyPage roomId={roomId} /> : null}
      {view === TEACHER_VIEW.STUDENTS ? <TeacherStudentsPage roomId={roomId} /> : null}
      {view === TEACHER_VIEW.SETS ? <TeacherSetsPage roomId={roomId} /> : null}
      {view === TEACHER_VIEW.AI ? <TeacherAiPage roomId={roomId} /> : null}
      {view === TEACHER_VIEW.SETTINGS ? <TeacherSettingsPage roomId={roomId} /> : null}
      {view === TEACHER_VIEW.DASHBOARD ? <TeacherDashboardPage roomId={roomId} /> : null}
    </>
  );
}
