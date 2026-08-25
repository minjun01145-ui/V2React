import { useEffect, useState } from "react";
import { moveTestStudentSlot, selectTestStudentSlot } from "../../../classroom-test/model.ts";
import PageShell from "../../../shared/PageShell.tsx";
import StatusPanel from "../../../shared/StatusPanel.tsx";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import TeacherRoomController from "../room-control/TeacherRoomController.tsx";
import styles from "./TeacherTestToolPage.module.css";
import TestStudentViewport from "./TestStudentViewport.tsx";
import { useMultiplayerTestTool } from "./useMultiplayerTestTool.ts";

export default function TeacherTestToolPage({ roomId }: { readonly roomId: string }) {
  const tool = useMultiplayerTestTool();
  const [activeSlot, setActiveSlot] = useState(1);
  const transitioning = tool.phase === "starting" || tool.phase === "stopping";
  const checked = tool.session !== null || tool.phase === "starting";

  useEffect(() => { if (tool.session) setActiveSlot(tool.session.students[0]?.slot ?? 1); }, [tool.session?.runId]);

  return <PageShell eyebrow="TEACHER TEST" title="실제 멀티플레이 테스트" roomId={roomId}>
    <Card className={styles.controlCard}>
      <div><Eyebrow>ISOLATED REAL SESSION</Eyebrow><h2>테스트 학생 3명</h2><Muted>실제 학생 앱·Firebase·게임 코드를 테스트 전용 방에서 그대로 실행합니다.</Muted></div>
      <label className={styles.toggle}>
        <input type="checkbox" checked={checked} disabled={transitioning} onChange={(event) => tool.setEnabled(event.target.checked)} />
        <span aria-hidden="true" />
        <strong>{tool.phase === "starting" ? "준비 중…" : tool.phase === "stopping" ? "종료 중…" : checked ? "테스트 실행 중" : "테스트 툴 꺼짐"}</strong>
      </label>
    </Card>

    {tool.error ? <StatusPanel title="테스트 세션 오류" tone="error">{tool.error.message}</StatusPanel> : null}

    {tool.session ? <div className={styles.workspace}>
      <TeacherRoomController roomId={tool.session.roomId} embedded />
      <TestStudentViewport
        session={tool.session}
        activeSlot={activeSlot}
        onPrevious={() => setActiveSlot((current) => moveTestStudentSlot(current, "previous", tool.session?.students ?? []))}
        onNext={() => setActiveSlot((current) => moveTestStudentSlot(current, "next", tool.session?.students ?? []))}
        onSelectSlot={(slot) => setActiveSlot((current) => selectTestStudentSlot(current, slot, tool.session?.students ?? []))}
      />
    </div> : <Card className={styles.emptyState}>
      <span>3</span>
      <div><h2>{tool.phase === "starting" ? "테스트 방을 만들고 있습니다" : "테스트 툴을 켜 주세요"}</h2><Muted>세 개의 독립 학생 앱이 실제 멀티플레이 방에 접속합니다.</Muted></div>
      {tool.phase === "error" ? <Button onClick={() => tool.setEnabled(true)}>다시 시도</Button> : null}
    </Card>}
  </PageShell>;
}
