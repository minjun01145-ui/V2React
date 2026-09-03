import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installDeploymentRecovery } from "../../app/installDeploymentRecovery.ts";
import AuthStatusPage from "../../shared/AuthStatusPage.tsx";
import "../../styles/tokens.css";
import "../../styles/reset.css";
import "../../styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

installDeploymentRecovery();

const root = createRoot(rootElement);
root.render(<StrictMode><AuthStatusPage eyebrow="TEACHER ACCESS" title="관리자 화면을 준비하고 있어요" message="잠시만 기다려 주세요." /></StrictMode>);

void import("./TeacherApp.tsx")
  .then(({ default: TeacherApp }) => {
    root.render(<StrictMode><TeacherApp /></StrictMode>);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "앱을 불러오지 못했습니다.";
    root.render(<StrictMode><AuthStatusPage eyebrow="STARTUP ERROR" title="관리자 화면을 시작할 수 없어요" message="환경 설정을 확인한 뒤 다시 시도해 주세요." error={message} /></StrictMode>);
  });
