import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import PageShell from "../../../shared/PageShell.tsx";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import {
  importStudentRoster,
  listStudentRoster,
  removeStudentRosterEntry,
  resetStudentRosterPin,
  saveStudentRosterEntry,
} from "../../../student-roster/repository.ts";
import type { StudentRosterEntry } from "../../../student-roster/types.ts";
import { parseRosterPaste } from "../../../student-roster/validation.ts";
import styles from "./TeacherStudentsPage.module.css";

interface Props {
  readonly roomId: string;
}

export default function TeacherStudentsPage({ roomId }: Props) {
  const [students, setStudents] = useState<readonly StudentRosterEntry[]>([]);
  const [studentNumber, setStudentNumber] = useState("");
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [bulkText, setBulkText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { requestConfirmation } = usePopup();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      setStudents(await listStudentRoster());
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학생 명단을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const counts = useMemo(() => ({
    total: students.length,
    active: students.filter((student) => student.active).length,
    pin: students.filter((student) => student.pinConfigured).length,
  }), [students]);

  const run = async (key: string, action: () => Promise<string>): Promise<void> => {
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    setNotice("");
    try {
      setNotice(await action());
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학생 명단 작업을 완료하지 못했습니다."));
    } finally {
      setBusyKey("");
    }
  };

  const submitSingle = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await run("save", async () => {
      await saveStudentRosterEntry({ studentNumber, name, active });
      setStudentNumber("");
      setName("");
      setActive(true);
      return "학생 정보를 저장했습니다.";
    });
  };

  const submitBulk = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await run("import", async () => {
      const parsed = parseRosterPaste(bulkText);
      const count = await importStudentRoster(parsed);
      setBulkText("");
      return `${count}명의 학생 정보를 반영했습니다.`;
    });
  };

  const editStudent = (student: StudentRosterEntry): void => {
    setStudentNumber(student.studentNumber);
    setName(student.displayName);
    setActive(student.active);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetPin = async (student: StudentRosterEntry): Promise<void> => {
    const confirmed = await requestConfirmation({
      eyebrow: "RESET PIN",
      title: `${student.displayName} 학생의 PIN을 초기화할까요?`,
      message: "기존 비밀번호로는 로그인할 수 없으며, 다음 로그인 때 새 숫자 4자리를 설정합니다.",
      tone: "warning",
      confirmLabel: "PIN 초기화",
      blurBackground: true,
    });
    if (!confirmed) return;
    await run(`pin-${student.studentNumber}`, async () => {
      await resetStudentRosterPin(student);
      return "PIN을 초기화했습니다. 다음 로그인 때 새 PIN을 설정합니다.";
    });
  };

  const removeStudent = async (student: StudentRosterEntry): Promise<void> => {
    const confirmed = await requestConfirmation({
      eyebrow: "DELETE STUDENT",
      title: `${student.studentNumber} ${student.displayName} 학생을 삭제할까요?`,
      message: "명단과 로그인 정보가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
      tone: "error",
      confirmLabel: "학생 삭제",
      blurBackground: true,
    });
    if (!confirmed) return;
    await run(`delete-${student.studentNumber}`, async () => {
      await removeStudentRosterEntry(student);
      return "학생을 명단에서 삭제했습니다.";
    });
  };

  return (
    <PageShell title="학생 관리" roomId={roomId} actions={<Button variant="ghost" onClick={() => void refresh()} disabled={loading || Boolean(busyKey)}>새로고침</Button>}>
      <div className={styles.stats}>
        <Card as="div"><span>전체 학생</span><strong>{counts.total}</strong></Card>
        <Card as="div"><span>로그인 가능</span><strong>{counts.active}</strong></Card>
        <Card as="div"><span>PIN 설정</span><strong>{counts.pin}</strong></Card>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.forms}>
        <Card as="form" className={styles.form} onSubmit={(event) => void submitSingle(event)}>
          <h2>학생 등록·수정</h2>
          <label>학번<input inputMode="numeric" maxLength={12} pattern="[0-9０-９]+" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} disabled={Boolean(busyKey)} required /></label>
          <label>이름<input maxLength={30} value={name} onChange={(event) => setName(event.target.value)} disabled={Boolean(busyKey)} required /></label>
          <label className={styles.check}><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} disabled={Boolean(busyKey)} /> 로그인 허용</label>
          <Button type="submit" disabled={Boolean(busyKey)}>{busyKey === "save" ? "저장 중…" : "저장"}</Button>
        </Card>

        <Card as="form" className={styles.form} onSubmit={(event) => void submitBulk(event)}>
          <h2>명단 붙여넣기</h2>
          <Muted>엑셀에서 학번·이름 두 열을 복사하거나 한 줄에 `학번,이름`.</Muted>
          <label>학생 명단<textarea rows={7} placeholder={'20301\t홍길동\n20302\t김주례'} value={bulkText} onChange={(event) => setBulkText(event.target.value)} disabled={Boolean(busyKey)} required /></label>
          <Button type="submit" disabled={Boolean(busyKey)}>{busyKey === "import" ? "등록 중…" : "반영"}</Button>
        </Card>
      </div>

      <Card className={styles.rosterCard}>
        <div className={styles.rosterHeading}><h2>등록된 학생</h2></div>
        {loading ? <p className={styles.empty}>학생 명단을 불러오는 중입니다.</p> : students.length === 0 ? <p className={styles.empty}>아직 등록된 학생이 없습니다.</p> : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>학번</th><th>이름</th><th>상태</th><th>PIN</th><th>관리</th></tr></thead>
              <tbody>{students.map((student) => {
                const key = student.studentNumber;
                return <tr key={key}>
                  <td><strong>{student.studentNumber}</strong></td>
                  <td>{student.displayName}</td>
                  <td><span className={student.active ? styles.activeBadge : styles.inactiveBadge}>{student.active ? "허용" : "중지"}</span></td>
                  <td>{student.pinConfigured ? "설정됨" : "첫 로그인 대기"}</td>
                  <td><div className={styles.actions}>
                    <button type="button" onClick={() => editStudent(student)} disabled={Boolean(busyKey)}>수정</button>
                    <button type="button" onClick={() => void run(`toggle-${key}`, async () => { await saveStudentRosterEntry({ studentNumber: key, name: student.displayName, active: !student.active }); return student.active ? "학생 로그인을 중지했습니다." : "학생 로그인을 다시 허용했습니다."; })} disabled={Boolean(busyKey)}>{student.active ? "중지" : "허용"}</button>
                    <button type="button" onClick={() => void resetPin(student)} disabled={Boolean(busyKey) || !student.pinConfigured}>PIN 초기화</button>
                    <button className={styles.danger} type="button" onClick={() => void removeStudent(student)} disabled={Boolean(busyKey)}>삭제</button>
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
