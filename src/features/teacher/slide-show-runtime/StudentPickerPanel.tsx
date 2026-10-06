import { useEffect, useRef, useState } from "react";
import type { Player } from "../../../multiplayer/types.ts";
import { pickStudentIndex } from "../../../student-picker/model.ts";
import { useJumpRace } from "../../../student-picker/jump-race/useJumpRace.ts";
import { requestDateStudentPick, type DateStudentPick } from "../../../student-picker/repository.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Button from "../../../shared/ui/Button.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import JumpRacePicker from "./jump-race/JumpRacePicker.tsx";
import LadderPicker from "./LadderPicker.tsx";
import styles from "./StudentPickerPanel.module.css";

type Mode = "simple" | "date" | "ladder" | "jump";
const MODES = [{ id: "simple", label: "단순 뽑기" }, { id: "date", label: "어이없는 뽑기" }, { id: "ladder", label: "사다리타기" }, { id: "jump", label: "점프타워" }] as const;

export default function StudentPickerPanel({ roomId, showRunId, players }: { readonly roomId: string; readonly showRunId: string; readonly players: readonly Player[] }) {
  const [mode, setMode] = useState<Mode>("simple");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [datePick, setDatePick] = useState<DateStudentPick | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const playersRef = useRef(players);
  playersRef.current = players;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const selected = players.find((player) => player.id === selectedId);
  // A running race keeps students off the slides, so reopening the panel goes straight to it.
  const raceId = useJumpRace(roomId, showRunId)?.raceId;
  useEffect(() => { if (raceId) setMode("jump"); }, [raceId]);

  const pick = async (): Promise<void> => {
    if (working || players.length === 0) return;
    setError("");
    setDatePick(null);
    setSelectedId(null);
    if (mode === "simple") {
      setSelectedId(players[pickStudentIndex(players.length)]!.id);
      return;
    }
    setWorking(true);
    try {
      const result = await requestDateStudentPick(roomId);
      if (!mounted.current) return;
      if (!playersRef.current.some((player) => player.id === result.playerId && player.studentNumber === result.studentNumber)) throw new Error("뽑힌 학생이 접속을 종료했습니다. 다시 뽑아 주세요.");
      setDatePick(result);
      setSelectedId(result.playerId);
    } catch (cause: unknown) {
      if (mounted.current) setError(toErrorMessage(cause, "AI 뽑기를 완료하지 못했습니다. 다시 시도해 주세요."));
    } finally {
      if (mounted.current) setWorking(false);
    }
  };

  return <section className={styles.panel} aria-label="학생 뽑기" data-picker-mode={mode}>
    <h2>학생 뽑기</h2>
    <SegmentedControl options={MODES} value={mode} disabled={working} onChange={(next) => { setMode(next); setSelectedId(null); setDatePick(null); setError(""); }} ariaLabel="뽑기 방식" size="sm" />
    {mode === "jump" ? <JumpRacePicker roomId={roomId} showRunId={showRunId} players={players} />
      : mode === "ladder" ? <LadderPicker key={JSON.stringify(players.map((player) => player.id))} players={players} /> : <>
      <Button onClick={() => void pick()} disabled={working || players.length === 0}>{working ? "AI가 계산하는 중…" : players.length === 0 ? "학생 접속 대기 중" : "뽑기"}</Button>
      <div className={styles.result} role="status">{selected ? `${selected.studentNumber}번 ${selected.displayName}` : selectedId ? "뽑힌 학생이 접속을 종료했습니다." : ""}</div>
      {datePick && selected ? <div className={styles.calculation}><strong>{datePick.date} · {datePick.title}</strong><ol>{datePick.calculation.map((line, index) => <li key={index}>{line}</li>)}</ol></div> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </>}
  </section>;
}
