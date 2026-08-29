import { useState } from "react";
import type { MultiplayerTestSession } from "../../../classroom-test/types.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import styles from "./TeacherTestToolPage.module.css";
import { useTestStudentFrames } from "./useTestStudentFrames.ts";

interface Props {
  readonly session: MultiplayerTestSession;
  readonly activeSlot: number;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onSelectSlot: (slot: number) => void;
}

export default function TestStudentViewport({ session, activeSlot, onPrevious, onNext, onSelectSlot }: Props) {
  const frames = useTestStudentFrames(session);
  const [viewport, setViewport] = useState<"mobile" | "tablet" | "desktop">("mobile");
  const [frameVersions, setFrameVersions] = useState<Readonly<Record<number, number>>>({});
  const activeStudent = session.students.find((student) => student.slot === activeSlot) ?? session.students[0];

  return <Card className={styles.viewerCard}>
    <div className={styles.cardHeading}>
      <div><h2>학생 화면</h2></div>
      <span className={styles.liveBadge}>실제 연결 · {activeStudent?.displayName ?? "학생"}</span>
    </div>
    <div className={styles.clientStates} aria-label="테스트 학생 연결 상태">
      {session.students.map((student) => {
        const state = frames.states.find((item) => item.slot === student.slot);
        return <button type="button" className={student.slot === activeSlot ? styles.activeClient : ""} onClick={() => onSelectSlot(student.slot)} title={state?.message} key={student.slot}>
          <span className={`${styles.stateDot} ${styles[state?.status ?? "loading"]}`} />
          <strong>{student.displayName}</strong>
          <small>{state?.status === "connected" ? "연결됨" : state?.status === "error" ? "오류" : state?.status === "left" ? "퇴장" : "연결 중"}</small>
        </button>;
      })}
    </div>
    <div className={styles.viewportControls} aria-label="학생 화면 크기">
      <span>화면 크기</span>
      <button type="button" className={viewport === "mobile" ? styles.activeViewport : ""} onClick={() => setViewport("mobile")}>휴대폰</button>
      <button type="button" className={viewport === "tablet" ? styles.activeViewport : ""} onClick={() => setViewport("tablet")}>태블릿</button>
      <button type="button" className={viewport === "desktop" ? styles.activeViewport : ""} onClick={() => setViewport("desktop")}>컴퓨터</button>
      <button type="button" onClick={() => frames.reloadFrame(activeSlot)}>새로고침</button>
      <button type="button" onClick={() => setFrameVersions((current) => ({ ...current, [activeSlot]: (current[activeSlot] ?? 0) + 1 }))}>다시 마운트</button>
    </div>
    <div className={`${styles.device} ${styles[viewport]}`}>
      <div className={styles.deviceBar}><span /><span /><span /><small>{activeStudent?.studentNumber ?? "TEST"}</small></div>
      <div className={styles.frameStack}>
        {session.students.map((student) => <iframe
          className={`${styles.studentFrame} ${student.slot === activeSlot ? styles.visibleFrame : styles.hiddenFrame}`}
          ref={(frame) => frames.attachFrame(student.slot, frame)}
          src={`/test-student/?slot=${student.slot}`}
          title={`${student.displayName} 실제 학생 화면`}
          sandbox="allow-scripts allow-same-origin allow-forms"
          key={`${session.runId}-${student.slot}-${frameVersions[student.slot] ?? 0}`}
        />)}
      </div>
    </div>
    <div className={styles.switcher} aria-label="학생 화면 전환">
      <Button variant="ghost" onClick={onPrevious}>← 이전 학생</Button>
      <span>{activeStudent ? `${activeStudent.studentNumber} · ${activeStudent.displayName}` : ""}</span>
      <Button variant="ghost" onClick={onNext}>다음 학생 →</Button>
    </div>
  </Card>;
}
