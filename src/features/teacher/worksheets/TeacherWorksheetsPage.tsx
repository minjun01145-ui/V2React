import { useEffect, useState } from "react";
import { getLearningSet, listLearningSets } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, type LearningSetSummary } from "../../../learning-sets/types.ts";
import { createPracticeWorksheet, createReadingWorksheet } from "../../../learning-worksheets/model.ts";
import { completeWorksheetMeanings, generatePracticeWorksheet } from "../../../learning-worksheets/repository.ts";
import { loadFonts } from "../../../fonts/loader.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import type { WorksheetDocument } from "../../../worksheet/types.ts";
import WorksheetView from "../../../worksheet/ui/WorksheetView.tsx";
import styles from "./TeacherWorksheetsPage.module.css";

export default function TeacherWorksheetsPage({ roomId }: { readonly roomId: string }) {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [setId, setSetId] = useState("");
  const [document, setDocument] = useState<WorksheetDocument | null>(null);
  const [busy, setBusy] = useState("load");
  const [error, setError] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    void listLearningSets().then(result => {
      if (!active) return;
      const readingSets = result.filter(set => set.type === LEARNING_SET_TYPE.READING_CHUNKS);
      setSets(readingSets); setSetId(readingSets[0]?.id ?? "");
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "학습 세트를 불러오지 못했습니다.")); })
      .finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, []);
  const generate = async (mode: "reading" | "practice"): Promise<void> => {
    setBusy(mode); setError(""); setLatencyMs(null);
    try {
      const set = await getLearningSet(setId, "worksheets", { allowMissingReadingMeanings: true });
      if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS || !set.items.length) throw new Error("본문이 있는 끊어읽기 세트를 선택해주세요.");
      let next: WorksheetDocument;
      if (mode === "reading") {
        const meanings = set.items.some(item => !item.meaning.trim()) ? await completeWorksheetMeanings(set) : [];
        next = createReadingWorksheet(set, meanings);
      } else {
        const result = await generatePracticeWorksheet(set);
        next = createPracticeWorksheet(set.name, result.sections); setLatencyMs(result.latencyMs);
      }
      await loadFonts(["'Noto Sans KR', sans-serif"], JSON.stringify(next), [400, 500, 700]);
      setDocument(next);
    } catch (value: unknown) { setError(toErrorMessage(value, "학습지를 생성하지 못했습니다.")); }
    finally { setBusy(""); }
  };
  return <PageShell title="학습자료 만들기" roomId={roomId} width="wide" actions={document ? <Button variant="ghost" onClick={() => window.print()} disabled={Boolean(busy)}>인쇄</Button> : null}>
    <div className={styles.page}>
    <Card as="div" className={styles.controls}>
      <label>끊어읽기 세트<select aria-label="끊어읽기 세트" value={setId} onChange={event => { setSetId(event.target.value); setDocument(null); setLatencyMs(null); setError(""); }} disabled={Boolean(busy)}><option value="" disabled>세트 선택</option>{sets.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
      <div className={styles.buttons}><Button onClick={() => void generate("reading")} disabled={Boolean(busy) || !setId}>{busy === "reading" ? "본문 학습지 생성 중…" : "본문 학습지 만들기"}</Button><Button onClick={() => void generate("practice")} disabled={Boolean(busy) || !setId}>{busy === "practice" ? "AI2 연습문제 생성 중…" : "연습문제 학습지 만들기"}</Button></div>
    </Card>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {busy ? <p role="status">{busy === "load" ? "세트 불러오는 중…" : "학습지 생성 중…"}</p> : !sets.length && !error ? <p>끊어읽기 세트가 없습니다.</p> : null}
    {latencyMs !== null ? <p role="status">AI2 응답 시간 {(latencyMs / 1000).toFixed(1)}초</p> : null}
    {document ? <div className={styles.preview}><WorksheetView document={document} /></div> : null}
    </div>
  </PageShell>;
}
