import { useEffect, useState } from "react";
import { getRoomIdFromLocation } from "../../app/location.ts";
import { signOutAdmin } from "../../auth/teacherAuth.ts";
import TeacherAiPage from "../../features/teacher/ai/TeacherAiPage.tsx";
import TeacherDashboardPage from "../../features/teacher/dashboard/TeacherDashboardPage.tsx";
import TeacherLobbyPage from "../../features/teacher/lobby/TeacherLobbyPage.tsx";
import TeacherQuizGamePage from "../../features/teacher/quiz-game/TeacherQuizGamePage.tsx";
import TeacherSetsPage from "../../features/teacher/sets/TeacherSetsPage.tsx";
import TeacherSettingsPage from "../../features/teacher/settings/TeacherSettingsPage.tsx";
import TeacherStudentsPage from "../../features/teacher/students/TeacherStudentsPage.tsx";
import TeacherTestToolPage from "../../features/teacher/test-tool/TeacherTestToolPage.tsx";
import TeacherNav from "./TeacherNav.tsx";
import type { TenantConfig } from "../../tenant/config.ts";
import { PRIMARY_TENANT_ID } from "../../tenant/scope.ts";
import { getTeacherView, TEACHER_VIEW, type TeacherView } from "./teacherRoute.ts";

export default function TeacherWorkspace({ tenant }: { readonly tenant: TenantConfig }) {
  const [view, setView] = useState<TeacherView>(getTeacherView);
  const roomId = getRoomIdFromLocation();
  const activeView = tenant.id !== PRIMARY_TENANT_ID && view === TEACHER_VIEW.AI ? TEACHER_VIEW.DASHBOARD : view;

  useEffect(() => {
    const handleHashChange = (): void => setView(getTeacherView());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <>
      <TeacherNav currentView={activeView} tenant={tenant} onLogout={signOutAdmin} />
      {activeView === TEACHER_VIEW.LOBBY ? <TeacherLobbyPage roomId={roomId} /> : null}
      {activeView === TEACHER_VIEW.STUDENTS ? <TeacherStudentsPage roomId={roomId} /> : null}
      {activeView === TEACHER_VIEW.SETS ? <TeacherSetsPage roomId={roomId} /> : null}
      {activeView === TEACHER_VIEW.QUIZ_GAME ? <TeacherQuizGamePage roomId={roomId} /> : null}
      {activeView === TEACHER_VIEW.AI ? <TeacherAiPage roomId={roomId} /> : null}
      {activeView === TEACHER_VIEW.TEST_TOOL ? <TeacherTestToolPage roomId={roomId} tenant={tenant} /> : null}
      {activeView === TEACHER_VIEW.SETTINGS ? <TeacherSettingsPage roomId={roomId} /> : null}
      {activeView === TEACHER_VIEW.DASHBOARD ? <TeacherDashboardPage roomId={roomId} showAiAdmin={tenant.id === PRIMARY_TENANT_ID} /> : null}
    </>
  );
}
