import { useAdminAuth } from "../../auth/hooks.ts";
import AdminLoginPage from "../../features/teacher/auth/AdminLoginPage.tsx";
import AuthStatusPage from "../../shared/AuthStatusPage.tsx";
import { PopupProvider } from "../../shared/popup/index.ts";
import { tenantConfigFromLocation } from "../../tenant/config.ts";
import TeacherWorkspace from "./TeacherWorkspace.tsx";

function TeacherAppContent({ tenant }: { readonly tenant: NonNullable<ReturnType<typeof tenantConfigFromLocation>> }) {
  const authState = useAdminAuth(tenant.id);
  if (authState.loading) {
    return <AuthStatusPage title="관리자 정보를 확인하고 있어요" message="잠시만 기다려 주세요." />;
  }
  if (authState.error) {
    return <AuthStatusPage title="관리자 로그인을 확인할 수 없어요" message="페이지를 새로고침한 뒤 다시 시도해 주세요." error={authState.error.message} />;
  }
  if (!authState.value) return <AdminLoginPage tenant={tenant} />;
  return <TeacherWorkspace tenant={tenant} />;
}

export default function TeacherApp() {
  const tenant = tenantConfigFromLocation();
  if (!tenant) return <AuthStatusPage title="사용자 주소를 확인해 주세요" message="등록되지 않은 사용자 주소입니다." />;
  document.title = `${tenant.brandAlt} | 관리자`;
  return <PopupProvider><TeacherAppContent tenant={tenant} /></PopupProvider>;
}
