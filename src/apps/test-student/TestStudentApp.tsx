import StudentPage from "../../features/student/StudentPage.tsx";
import AuthStatusPage from "../../shared/AuthStatusPage.tsx";
import { PopupProvider } from "../../shared/popup/index.ts";
import { useTestStudentBootstrap } from "./useTestStudentBootstrap.ts";

function TestStudentAppContent() {
  const bootstrap = useTestStudentBootstrap();
  if (bootstrap.error) return <AuthStatusPage eyebrow="TEST CLIENT" title="테스트 학생을 연결하지 못했습니다" message="테스트 툴을 껐다가 다시 켜 주세요." error={bootstrap.error.message} />;
  if (bootstrap.ended) return <AuthStatusPage eyebrow="TEST CLIENT" title="대기실에서 나왔습니다" message="테스트 툴을 다시 시작하면 재접속합니다." />;
  if (!bootstrap.value) return <AuthStatusPage eyebrow="TEST CLIENT" title="테스트 학생을 준비하고 있어요" message="교사용 테스트 툴과 연결 중입니다." />;
  return <StudentPage roomId={bootstrap.value.roomId} identity={bootstrap.value.identity} onChangeStudent={bootstrap.leave} />;
}

export default function TestStudentApp() {
  return <PopupProvider><TestStudentAppContent /></PopupProvider>;
}
