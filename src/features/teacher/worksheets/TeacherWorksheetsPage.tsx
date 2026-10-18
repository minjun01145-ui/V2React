import { useEffect, useState } from "react";
import { loadFonts } from "../../../fonts/loader.ts";
import { getLearningSet, listLearningSets } from "../../../learning-sets/readRepository.ts";
import { LEARNING_SET_TYPE, type LearningSetSummary, type RuntimeLearningSet } from "../../../learning-sets/types.ts";
import {
  WORKSHEET_KINDS,
  createPracticeWorksheet,
  createReadingWorksheet,
  createRecitationWorksheet,
  type WorksheetKind,
  type WorksheetUsage,
} from "../../../learning-worksheets/model.ts";
import { completeWorksheetMeanings, generatePracticeWorksheet, loadSavedWorksheet, saveWorksheet, type SavedWorksheet } from "../../../learning-worksheets/repository.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import PageShell from "../../../shared/PageShell.tsx";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import SegmentedControl from "../../../shared/ui/SegmentedControl.tsx";
import WorksheetView from "../../../worksheet/ui/WorksheetView.tsx";
import styles from "./TeacherWorksheetsPage.module.css";

const KIND_OPTIONS = (Object.keys(WORKSHEET_KINDS) as WorksheetKind[]).map((id) => ({ id, label: WORKSHEET_KINDS[id] }));

/** Builds one worksheet kind; only the practice worksheet and missing meanings need the AI. */
async function buildWorksheet(set: RuntimeLearningSet, kind: WorksheetKind): Promise<SavedWorksheet> {
  if (kind === "practice") {
    const result = await generatePracticeWorksheet(set);
    return { document: createPracticeWorksheet(set, result.sections), usage: result.usage };
  }
  const { meanings, usage } = await completeWorksheetMeanings(set);
  return { document: kind === "reading" ? createReadingWorksheet(set, meanings) : createRecitationWorksheet(set, meanings), usage };
}

function usageLabel(usage: WorksheetUsage): string {
  const format = (value: number | null): string => value === null ? "-" : value.toLocaleString("ko-KR");
  return `AI 토큰 입력 ${format(usage.promptTokens)} · 출력 ${format(usage.outputTokens)}`;
}

export default function TeacherWorksheetsPage({ roomId }: { readonly roomId: string }) {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [setId, setSetId] = useState("");
  const [kind, setKind] = useState<WorksheetKind>("reading");
  const [worksheet, setWorksheet] = useState<SavedWorksheet | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<"" | "sets" | "load" | "generate" | "save">("sets");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void listLearningSets().then((result) => {
      if (!active) return;
      const readingSets = result.filter((set) => set.type === LEARNING_SET_TYPE.READING_CHUNKS);
      setSets(readingSets);
      setSetId(readingSets[0]?.id ?? "");
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "학습 세트를 불러오지 못했습니다.")); })
      .finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, []);

  // A saved worksheet for the chosen set and kind opens straight away.
  useEffect(() => {
    if (!setId) return undefined;
    let active = true;
    setWorksheet(null);
    setSaved(false);
    setError("");
    setBusy("load");
    void loadSavedWorksheet(setId, kind).then(async (result) => {
      if (!active) return;
      if (result) await loadFonts(["'Noto Sans KR', sans-serif"], JSON.stringify(result.document), [400, 500, 700]);
      if (!active) return;
      setWorksheet(result);
      setSaved(result !== null);
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "저장된 학습지를 불러오지 못했습니다.")); })
      .finally(() => { if (active) setBusy(""); });
    return () => { active = false; };
  }, [kind, setId]);

  const generate = async (): Promise<void> => {
    setBusy("generate");
    setError("");
    try {
      const set = await getLearningSet(setId, "worksheets", { allowMissingReadingMeanings: true });
      if (set.type !== LEARNING_SET_TYPE.READING_CHUNKS || !set.items.length) throw new Error("본문이 있는 끊어읽기 세트를 선택해주세요.");
      const next = await buildWorksheet(set, kind);
      await loadFonts(["'Noto Sans KR', sans-serif"], JSON.stringify(next.document), [400, 500, 700]);
      setWorksheet(next);
      setSaved(false);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습지를 생성하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const save = async (): Promise<void> => {
    if (!worksheet) return;
    setBusy("save");
    setError("");
    try {
      await saveWorksheet(setId, kind, worksheet);
      setSaved(true);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습지를 저장하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const generateLabel = busy === "generate" ? "생성 중…" : worksheet ? "재생성" : `${WORKSHEET_KINDS[kind]} 만들기`;
  return <PageShell title="학습자료 만들기" roomId={roomId} width="wide">
    <div className={styles.page}>
      <Card as="div" className={styles.controls}>
        <label>끊어읽기 세트<select aria-label="끊어읽기 세트" value={setId} onChange={(event) => setSetId(event.target.value)} disabled={Boolean(busy)}>
          <option value="" disabled>세트 선택</option>
          {sets.map((set) => <option key={set.id} value={set.id}>{set.name}</option>)}
        </select></label>
        <SegmentedControl ariaLabel="학습지 종류" options={KIND_OPTIONS} value={kind} onChange={setKind} disabled={Boolean(busy)} />
        <div className={styles.buttons}>
          <Button onClick={() => void generate()} disabled={Boolean(busy) || !setId}>{generateLabel}</Button>
          {worksheet ? <Button variant="accent" onClick={() => void save()} disabled={Boolean(busy) || saved}>{busy === "save" ? "저장 중…" : saved ? "저장됨" : "저장"}</Button> : null}
          {worksheet ? <Button variant="ghost" onClick={() => window.print()} disabled={Boolean(busy)}>인쇄</Button> : null}
          {worksheet?.usage ? <span className={styles.usage} role="status">{usageLabel(worksheet.usage)}</span> : null}
        </div>
      </Card>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      {busy === "sets" || busy === "load" ? <p role="status">불러오는 중…</p> : null}
      {busy === "generate" ? <p role="status">{kind === "practice" ? "AI2가 연습문제를 만드는 중…" : "학습지를 만드는 중…"}</p> : null}
      {!busy && !sets.length && !error ? <p>끊어읽기 세트가 없습니다.</p> : null}
      {worksheet ? <div className={styles.preview}><WorksheetView document={worksheet.document} /></div> : null}
    </div>
  </PageShell>;
}
