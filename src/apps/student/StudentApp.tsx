import { useState } from "react";
import { useStudentAuth } from "../../auth/hooks.ts";
import { clearStudentLogin } from "../../auth/studentAuth.ts";
import type { StudentIdentity } from "../../auth/types.ts";
import { getRoomIdFromLocation } from "../../app/location.ts";
import StudentPage from "../../features/student/StudentPage.tsx";
import StudentLoginPage from "../../features/student/login/StudentLoginPage.tsx";
import AuthStatusPage from "../../shared/AuthStatusPage.tsx";
import { PopupProvider } from "../../shared/popup/index.ts";

function StudentAppContent() {
  const roomId = getRoomIdFromLocation();
  const authState = useStudentAuth();
  const [claimedIdentity, setClaimedIdentity] = useState<StudentIdentity | null>(null);
  const identity = authState.value ?? claimedIdentity;

  if (authState.loading && !identity) {
    return <AuthStatusPage eyebrow="JURYE" title="수업을 준비하고 있어요" message="잠시만 기다려 주세요." />;
  }
  if (authState.error && !identity) {
    return <AuthStatusPage eyebrow="CONNECTION ERROR" title="로그인 정보를 확인할 수 없어요" message="페이지를 새로고침한 뒤 다시 시도해 주세요." error={authState.error.message} />;
  }
  if (!identity) return <StudentLoginPage roomId={roomId} onAuthenticated={setClaimedIdentity} />;

  return <StudentPage
    roomId={roomId}
    identity={identity}
    onChangeStudent={async () => {
      setClaimedIdentity(null);
      await clearStudentLogin();
    }}
  />;
}

export default function StudentApp() {
  return <PopupProvider><StudentAppContent /></PopupProvider>;
}
