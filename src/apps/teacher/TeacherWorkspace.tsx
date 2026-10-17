import { lazy, Suspense, useEffect, useState } from "react";
import { getRoomIdFromLocation } from "../../app/location.ts";
import { signOutAdmin } from "../../auth/teacherAuth.ts";
import TeacherLobbyPage from "../../features/teacher/lobby/TeacherLobbyPage.tsx";
import TeacherSetsPage from "../../features/teacher/sets/TeacherSetsPage.tsx";
import TeacherSettingsPage from "../../features/teacher/settings/TeacherSettingsPage.tsx";
import TeacherStudentsPage from "../../features/teacher/students/TeacherStudentsPage.tsx";
import TeacherOpinionsPage from "../../features/teacher/opinions/TeacherOpinionsPage.tsx";
import TeacherNav from "./TeacherNav.tsx";
import type { TenantConfig } from "../../tenant/config.ts";
import { getTeacherView, getSettingsSection, TEACHER_VIEW } from "./teacherRoute.ts";
import styles from "./TeacherWorkspace.module.css";

// The slide editor pulls in Fabric.js; load it only when the teacher opens it.
const TeacherSlideShowPage = lazy(() => import("../../features/teacher/slide-show/TeacherSlideShowPage.tsx"));

export default function TeacherWorkspace({ tenant }: { readonly tenant: TenantConfig }) {
  const [hash, setHash] = useState(() => window.location.hash);
  const activeView = getTeacherView(hash);
  const roomId = getRoomIdFromLocation();

  useEffect(() => {
    const handleHashChange = (): void => setHash(window.location.hash);
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <div className={styles.workspace}>
      <TeacherNav currentView={activeView} tenant={tenant} onLogout={signOutAdmin} />
      <div className={styles.main}>
        {activeView === TEACHER_VIEW.LOBBY ? <TeacherLobbyPage roomId={roomId} /> : null}
        {activeView === TEACHER_VIEW.STUDENTS ? <TeacherStudentsPage roomId={roomId} /> : null}
        {activeView === TEACHER_VIEW.OPINIONS ? <TeacherOpinionsPage roomId={roomId} /> : null}
        {activeView === TEACHER_VIEW.SETS ? <TeacherSetsPage roomId={roomId} /> : null}
        {activeView === TEACHER_VIEW.SLIDE_SHOW ? <Suspense fallback={null}><TeacherSlideShowPage roomId={roomId} /></Suspense> : null}
        {activeView === TEACHER_VIEW.SETTINGS ? <TeacherSettingsPage roomId={roomId} tenant={tenant} section={getSettingsSection(hash)} onSectionChange={(section) => { window.location.hash = `#/settings/${section}`; }} /> : null}
      </div>
    </div>
  );
}
