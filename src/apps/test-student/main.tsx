import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AuthStatusPage from "../../shared/AuthStatusPage.tsx";
import "../../styles/tokens.css";
import "../../styles/reset.css";
import "../../styles/global.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("#root element not found");

const root = createRoot(rootElement);
root.render(<StrictMode><AuthStatusPage eyebrow="TEST CLIENT" title="학생 화면을 준비하고 있어요" message="잠시만 기다려 주세요." /></StrictMode>);

void import("./TestStudentApp.tsx")
  .then(({ default: TestStudentApp }) => root.render(<StrictMode><TestStudentApp /></StrictMode>))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "테스트 학생 앱을 불러오지 못했습니다.";
    root.render(<StrictMode><AuthStatusPage eyebrow="STARTUP ERROR" title="테스트 학생 화면을 시작할 수 없어요" message="환경 설정을 확인해 주세요." error={message} /></StrictMode>);
  });
