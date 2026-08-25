import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { deleteLearningSet, saveLearningSet } from "../../../learning-sets/adminRepository.ts";
import { getLearningSet, listLearningSets } from "../../../learning-sets/readRepository.ts";
import {
  LEARNING_SET_TYPE,
  learningSetTypeLabel,
  type LearningSetSummary,
  type LearningSetType,
} from "../../../learning-sets/types.ts";
import { parseLearningSetPaste, serializeLearningSetItems, validateLearningSetName } from "../../../learning-sets/validation.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import PageShell from "../../../shared/PageShell.tsx";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Eyebrow, Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherSetsPage.module.css";

export default function TeacherSetsPage({ roomId }: { readonly roomId: string }) {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [selected, setSelected] = useState<LearningSetSummary | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<LearningSetType>(LEARNING_SET_TYPE.VOCABULARY);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { requestConfirmation } = usePopup();

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError("");
    try {
      setSets(await listLearningSets());
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습 세트 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const preview = useMemo(() => {
    if (!pasteText.trim()) return { items: [], error: "" } as const;
    try {
      return { items: parseLearningSetPaste(pasteText, type), error: "" } as const;
    } catch (value: unknown) {
      return { items: [], error: toErrorMessage(value, "입력 형식을 확인해 주세요.") } as const;
    }
  }, [pasteText, type]);

  const counts = useMemo(() => ({
    vocabulary: sets.filter((set) => set.type === LEARNING_SET_TYPE.VOCABULARY).length,
    reading: sets.filter((set) => set.type === LEARNING_SET_TYPE.READING_CHUNKS).length,
  }), [sets]);

  const newSet = (): void => {
    setSelected(null);
    setName("");
    setType(LEARNING_SET_TYPE.VOCABULARY);
    setPasteText("");
    setError("");
    setNotice("");
  };

  const editSet = async (summary: LearningSetSummary): Promise<void> => {
    if (busy) return;
    setBusy(`load-${summary.id}`);
    setError("");
    setNotice("");
    try {
      const set = await getLearningSet(summary.id);
      setSelected(set);
      setName(set.name);
      setType(set.type);
      setPasteText(serializeLearningSetItems(set.items));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습 세트를 불러오지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const saved = await saveLearningSet({
        ...(selected ? { id: selected.id, createdAtMs: selected.createdAtMs } : {}),
        name: validateLearningSetName(name),
        type,
        items: parseLearningSetPaste(pasteText, type),
      });
      setSelected(saved);
      setName(saved.name);
      setPasteText(serializeLearningSetItems(saved.items));
      setNotice(`“${saved.name}” 세트 ${saved.itemCount}개 항목을 저장했습니다.`);
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습 세트를 저장하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const remove = async (): Promise<void> => {
    if (!selected || busy) return;
    const confirmed = await requestConfirmation({
      eyebrow: "DELETE SET",
      title: `“${selected.name}” 세트를 삭제할까요?`,
      message: "진행 중인 게임에서 사용 중이면 학생이 더 이상 이 세트를 불러올 수 없습니다.",
      tone: "error",
      confirmLabel: "세트 삭제",
      blurBackground: true,
    });
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    setNotice("");
    try {
      await deleteLearningSet(selected.id);
      newSet();
      setNotice("학습 세트를 삭제했습니다.");
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습 세트를 삭제하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const readingType = type === LEARNING_SET_TYPE.READING_CHUNKS;

  return (
    <PageShell eyebrow="LEARNING SETS" title="학습 세트 편집" roomId={roomId} actions={<Button variant="ghost" onClick={newSet} disabled={Boolean(busy)}>새 세트</Button>}>
      <div className={styles.stats}>
        <Card as="div"><span>전체 세트</span><strong>{sets.length}</strong></Card>
        <Card as="div"><span>단어</span><strong>{counts.vocabulary}</strong></Card>
        <Card as="div"><span>끊어읽기</span><strong>{counts.reading}</strong></Card>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.workspace}>
        <Card className={styles.listCard}>
          <div className={styles.heading}><div><Eyebrow>SAVED SETS</Eyebrow><h2>저장된 세트</h2></div><Button variant="ghost" onClick={() => void refresh()} disabled={loading || Boolean(busy)}>새로고침</Button></div>
          {loading ? <p className={styles.empty}>세트 목록을 불러오는 중입니다.</p> : sets.length === 0 ? <p className={styles.empty}>아직 저장된 세트가 없습니다.</p> : (
            <div className={styles.setList}>{sets.map((set) => (
              <button className={`${styles.setRow} ${selected?.id === set.id ? styles.selected : ""}`} type="button" onClick={() => void editSet(set)} disabled={Boolean(busy)} key={set.id}>
                <span><strong>{set.name}</strong><small>{learningSetTypeLabel(set.type)} · {set.itemCount}개</small></span>
                <span aria-hidden="true">→</span>
              </button>
            ))}</div>
          )}
        </Card>

        <Card as="form" className={styles.editor} onSubmit={(event) => void submit(event)}>
          <div><Eyebrow>{selected ? "EDIT SET" : "NEW SET"}</Eyebrow><h2>{selected ? "세트 수정" : "새 세트"}</h2></div>
          <div className={styles.fields}>
            <label>세트 이름<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} disabled={Boolean(busy)} placeholder="예: 1학기 필수 단어" required /></label>
            <label>타입<select value={type} onChange={(event) => setType(event.target.value as LearningSetType)} disabled={Boolean(busy)}><option value={LEARNING_SET_TYPE.VOCABULARY}>단어</option><option value={LEARNING_SET_TYPE.READING_CHUNKS}>끊어읽기</option></select></label>
          </div>
          <label>내용<textarea rows={13} value={pasteText} onChange={(event) => setPasteText(event.target.value)} disabled={Boolean(busy)} placeholder={readingType ? "I go / to school.\t나는 / 학교에 간다." : "apple\t사과\nclassroom\t교실"} required /></label>

          <div className={styles.preview}>
            <div className={styles.heading}><div><Eyebrow>PREVIEW</Eyebrow><h3>인식 결과</h3></div><strong>{preview.items.length}개</strong></div>
            {preview.error ? <p className={styles.previewError}>{preview.error}</p> : preview.items.length === 0 ? <p className={styles.empty}>붙여넣으면 여기에 표시됩니다.</p> : (
              <div className={styles.previewRows}>{preview.items.slice(0, 8).map((item) => <div key={item.id}><span>{item.sourceText}</span><span>{item.meaning}</span></div>)}{preview.items.length > 8 ? <small>외 {preview.items.length - 8}개</small> : null}</div>
            )}
          </div>

          <div className={styles.actions}>
            <Button type="submit" disabled={Boolean(busy) || Boolean(preview.error) || preview.items.length === 0}>{busy === "save" ? "저장 중…" : selected ? "저장" : "세트 저장"}</Button>
            {selected ? <Button variant="ghost" onClick={() => void remove()} disabled={Boolean(busy)}>{busy === "delete" ? "삭제 중…" : "삭제"}</Button> : null}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
