import { useAdminAuth } from "../../auth/hooks.ts";
import AdminLoginPage from "../../features/teacher/auth/AdminLoginPage.tsx";
import AuthStatusPage from "../../shared/AuthStatusPage.tsx";
import TeacherWorkspace from "./TeacherWorkspace.tsx";

export default function TeacherApp() {
  const authState = useAdminAuth();
  if (authState.loading) {
    return <AuthStatusPage eyebrow="TEACHER ACCESS" title="관리자 정보를 확인하고 있어요" message="잠시만 기다려 주세요." />;
  }
  if (authState.error) {
    return <AuthStatusPage eyebrow="CONNECTION ERROR" title="관리자 로그인을 확인할 수 없어요" message="페이지를 새로고침한 뒤 다시 시도해 주세요." error={authState.error.message} />;
  }
  if (!authState.value) return <AdminLoginPage />;
  return <TeacherWorkspace />;
}
