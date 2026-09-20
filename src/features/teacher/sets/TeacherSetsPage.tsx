import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AI_SOURCE_FILE_ACCEPT,
  MAX_AI_SOURCE_TEXT_CHARACTERS,
  browserFileForLearningSetGeneration,
  generateLearningSetDraft,
  isAiGeneratableLearningSetType,
} from "../../../learning-sets/aiGeneration.ts";
import { deleteLearningSet, saveLearningSet } from "../../../learning-sets/adminRepository.ts";
import { getLearningSet, listLearningSets } from "../../../learning-sets/readRepository.ts";
import {
  LEARNING_SET_TYPE,
  learningSetTypeLabel,
  type LearningSetItem,
  type LearningSetSummary,
  type LearningSetType,
} from "../../../learning-sets/types.ts";
import { parseLearningSetPaste, serializeLearningSetItems, validateLearningSetName } from "../../../learning-sets/validation.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import PageShell from "../../../shared/PageShell.tsx";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import { Muted } from "../../../shared/ui/Typography.tsx";
import styles from "./TeacherSetsPage.module.css";

function blankFormChangeItem(): LearningSetItem {
  return { id: `draft-${crypto.randomUUID()}`, sourceText: "", meaning: "", form2: "", form3: "" };
}

function formChangeDraftText(items: readonly LearningSetItem[]): string {
  return items.map((item) => `${item.meaning}\t${item.sourceText}\t${item.form2 ?? ""}\t${item.form3 ?? ""}`).join("\n");
}

export default function TeacherSetsPage({ roomId }: { readonly roomId: string }) {
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [selected, setSelected] = useState<LearningSetSummary | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<LearningSetType>(LEARNING_SET_TYPE.VOCABULARY);
  const [pasteText, setPasteText] = useState("");
  const [formChangeItems, setFormChangeItems] = useState<readonly LearningSetItem[]>([blankFormChangeItem()]);
  const [aiSourceText, setAiSourceText] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const aiFileInputRef = useRef<HTMLInputElement>(null);
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

  const formChangeType = type === LEARNING_SET_TYPE.FORM_CHANGES;
  const preview = useMemo(() => {
    const content = formChangeType ? formChangeDraftText(formChangeItems) : pasteText;
    if (!content.replaceAll("\t", "").trim()) return { items: [], error: "" } as const;
    try {
      return { items: parseLearningSetPaste(content, type), error: "" } as const;
    } catch (value: unknown) {
      return { items: [], error: toErrorMessage(value, "입력 형식을 확인해 주세요.") } as const;
    }
  }, [formChangeItems, formChangeType, pasteText, type]);

  const counts = useMemo(() => ({
    vocabulary: sets.filter((set) => set.type === LEARNING_SET_TYPE.VOCABULARY).length,
    reading: sets.filter((set) => set.type === LEARNING_SET_TYPE.READING_CHUNKS).length,
    formChanges: sets.filter((set) => set.type === LEARNING_SET_TYPE.FORM_CHANGES).length,
  }), [sets]);

  const clearAiSource = (): void => {
    setAiSourceText("");
    setAiFile(null);
    if (aiFileInputRef.current) aiFileInputRef.current.value = "";
  };

  const newSet = (): void => {
    setSelected(null);
    setName("");
    setType(LEARNING_SET_TYPE.VOCABULARY);
    setPasteText("");
    setFormChangeItems([blankFormChangeItem()]);
    clearAiSource();
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
      if (set.type === LEARNING_SET_TYPE.FORM_CHANGES) {
        setFormChangeItems(set.items.map((item) => ({ ...item })));
        setPasteText("");
      } else {
        setPasteText(serializeLearningSetItems(set.items, set.type));
        setFormChangeItems([blankFormChangeItem()]);
      }
      clearAiSource();
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
    if (preview.error || preview.items.length === 0) {
      setError(preview.error || "학습 세트 내용을 한 개 이상 입력해 주세요.");
      return;
    }
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const saved = await saveLearningSet({
        ...(selected ? { id: selected.id, createdAtMs: selected.createdAtMs } : {}),
        name: validateLearningSetName(name),
        type,
        items: preview.items,
      });
      setSelected(saved);
      setName(saved.name);
      if (saved.type === LEARNING_SET_TYPE.FORM_CHANGES) setFormChangeItems(saved.items.map((item) => ({ ...item })));
      else setPasteText(serializeLearningSetItems(saved.items, saved.type));
      setNotice(`“${saved.name}” 세트 ${saved.itemCount}개 항목을 저장했습니다.`);
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "학습 세트를 저장하지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const updateFormChangeItem = (index: number, patch: Partial<Pick<LearningSetItem, "meaning" | "sourceText" | "form2" | "form3">>): void => {
    setFormChangeItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addFormChangeItem = (): void => {
    setFormChangeItems((current) => [...current, blankFormChangeItem()]);
  };

  const removeFormChangeItem = (index: number): void => {
    setFormChangeItems((current) => current.length === 1
      ? [blankFormChangeItem()]
      : current.filter((_item, itemIndex) => itemIndex !== index));
  };

  const generateWithAi = async (): Promise<void> => {
    if (busy || !isAiGeneratableLearningSetType(type)) return;
    if (!aiSourceText.trim() && !aiFile) {
      setError("AI로 만들 자료를 붙여넣거나 파일을 선택해 주세요.");
      return;
    }
    setBusy("ai-generate");
    setError("");
    setNotice("");
    try {
      const file = aiFile ? await browserFileForLearningSetGeneration(aiFile) : null;
      const generated = await generateLearningSetDraft({ type, sourceText: aiSourceText.trim(), file });
      if (!name.trim() && generated.suggestedName) setName(generated.suggestedName);
      if (type === LEARNING_SET_TYPE.FORM_CHANGES) setFormChangeItems(generated.items);
      else setPasteText(serializeLearningSetItems(generated.items, type));
      setNotice(`AI가 ${generated.items.length}개 항목을 만들었습니다. 내용을 확인한 뒤 저장해 주세요.`);
    } catch (value: unknown) {
      setError(toErrorMessage(value, "AI로 학습세트를 만들지 못했습니다."));
    } finally {
      setBusy("");
    }
  };

  const remove = async (): Promise<void> => {
    if (!selected || busy) return;
    const confirmed = await requestConfirmation({
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
  const studentQuestionType = type === LEARNING_SET_TYPE.STUDENT_QUESTIONS;

  return (
    <PageShell title="학습 세트 편집" roomId={roomId} actions={<Button variant="ghost" onClick={newSet} disabled={Boolean(busy)}>새 세트</Button>}>
      <div className={styles.stats}>
        <Card as="div"><span>전체 세트</span><strong>{sets.length}</strong></Card>
        <Card as="div"><span>단어</span><strong>{counts.vocabulary}</strong></Card>
        <Card as="div"><span>끊어읽기</span><strong>{counts.reading}</strong></Card>
        <Card as="div"><span>단어 변화형</span><strong>{counts.formChanges}</strong></Card>
        <Card as="div"><span>학생 질문</span><strong>{sets.filter((set) => set.type === LEARNING_SET_TYPE.STUDENT_QUESTIONS).length}</strong></Card>
      </div>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.workspace}>
        <Card className={styles.listCard}>
          <div className={styles.heading}><h2>저장된 세트</h2><Button variant="ghost" onClick={() => void refresh()} disabled={loading || Boolean(busy)}>새로고침</Button></div>
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
          <div><h2>{selected ? "세트 수정" : "새 세트"}</h2></div>
          <div className={styles.fields}>
            <label>세트 이름<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} disabled={Boolean(busy) || studentQuestionType} placeholder="예: 1학기 필수 단어" required /></label>
            <label>타입<select value={type} onChange={(event) => setType(event.target.value as LearningSetType)} disabled={Boolean(busy) || studentQuestionType}><option value={LEARNING_SET_TYPE.VOCABULARY}>단어</option><option value={LEARNING_SET_TYPE.READING_CHUNKS}>끊어읽기</option><option value={LEARNING_SET_TYPE.FORM_CHANGES}>단어 변화형</option>{studentQuestionType ? <option value={LEARNING_SET_TYPE.STUDENT_QUESTIONS}>학생 질문</option> : null}</select></label>
          </div>
          {formChangeType ? (
            <div className={styles.formChangeEditor}>
              <div className={styles.formChangeHeader}><span>뜻</span><span>1단계</span><span>2단계</span><span>3단계</span><span /></div>
              {formChangeItems.map((item, index) => (
                <div className={styles.formChangeRow} key={item.id}>
                  <input aria-label={`${index + 1}번 뜻`} value={item.meaning} onChange={(event) => updateFormChangeItem(index, { meaning: event.target.value })} disabled={Boolean(busy)} placeholder="빠른" />
                  <input aria-label={`${index + 1}번 1단계`} value={item.sourceText} onChange={(event) => updateFormChangeItem(index, { sourceText: event.target.value })} disabled={Boolean(busy)} placeholder="fast" />
                  <input aria-label={`${index + 1}번 2단계`} value={item.form2 ?? ""} onChange={(event) => updateFormChangeItem(index, { form2: event.target.value })} disabled={Boolean(busy)} placeholder="faster" />
                  <input aria-label={`${index + 1}번 3단계`} value={item.form3 ?? ""} onChange={(event) => updateFormChangeItem(index, { form3: event.target.value })} disabled={Boolean(busy)} placeholder="the fastest" />
                  <Button type="button" variant="ghost" onClick={() => removeFormChangeItem(index)} disabled={Boolean(busy)}>삭제</Button>
                </div>
              ))}
              <div><Button type="button" variant="ghost" onClick={addFormChangeItem} disabled={Boolean(busy)}>행 추가</Button></div>
            </div>
          ) : <label>내용<textarea rows={13} value={pasteText} onChange={(event) => setPasteText(event.target.value)} disabled={Boolean(busy) || studentQuestionType} placeholder={readingType ? "I go / to school.\t나는 / 학교에 간다." : "apple\t사과\nclassroom\t교실"} required /></label>}
          {studentQuestionType ? <Muted>학생 질문 세트는 작성자 정보를 보존하기 위해 읽기 전용으로 표시됩니다.</Muted> : null}

          {!studentQuestionType ? (
            <div className={styles.aiAssist}>
              <div className={styles.heading}><div><h3>AI로 내용 만들기</h3><Muted>자료를 붙여넣거나 PDF·텍스트 파일을 하나 선택하세요. 결과는 위 편집칸에 채워지며 자동 저장되지 않습니다.</Muted></div></div>
              <textarea
                rows={5}
                maxLength={MAX_AI_SOURCE_TEXT_CHARACTERS}
                value={aiSourceText}
                onChange={(event) => {
                  const value = event.target.value;
                  setAiSourceText(value);
                  if (value.trim() && aiFile) {
                    setAiFile(null);
                    if (aiFileInputRef.current) aiFileInputRef.current.value = "";
                  }
                }}
                disabled={Boolean(busy)}
                placeholder={formChangeType ? "예: PDF의 표 내용을 붙여넣거나 아래에서 PDF 파일을 선택하세요." : readingType ? "영어 문장만 붙여넣어도 현재 끊어읽기 방식으로 나누고 뜻을 붙입니다." : "단어 목록, 본문 일부, 표 등을 붙여넣으세요."}
              />
              <div className={styles.aiFileRow}>
                <input ref={aiFileInputRef} type="file" accept={AI_SOURCE_FILE_ACCEPT} disabled={Boolean(busy)} onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setAiFile(file);
                  if (file) setAiSourceText("");
                }} />
                {aiFile ? <small>{aiFile.name}</small> : null}
                <Button type="button" onClick={() => void generateWithAi()} disabled={Boolean(busy) || (!aiSourceText.trim() && !aiFile)}>{busy === "ai-generate" ? "AI 변환 중…" : "AI로 세트 만들기"}</Button>
              </div>
            </div>
          ) : null}

          <div className={styles.preview}>
            <div className={styles.heading}><h3>인식 결과</h3><strong>{preview.items.length}개</strong></div>
            {preview.error ? <p className={styles.previewError}>{preview.error}</p> : preview.items.length === 0 ? <p className={styles.empty}>내용을 입력하면 여기에 표시됩니다.</p> : (
              <div className={`${styles.previewRows} ${formChangeType ? styles.formPreviewRows : ""}`}>{preview.items.slice(0, 8).map((item) => <div key={item.id}>{formChangeType ? <><span>{item.meaning}</span><span>{item.sourceText}</span><span>{item.form2}</span><span>{item.form3}</span></> : <><span>{item.sourceText}</span><span>{item.meaning}</span></>}</div>)}{preview.items.length > 8 ? <small>외 {preview.items.length - 8}개</small> : null}</div>
            )}
          </div>

          <div className={styles.actions}>
            {!studentQuestionType ? <Button type="submit" disabled={Boolean(busy) || Boolean(preview.error) || preview.items.length === 0}>{busy === "save" ? "저장 중…" : selected ? "저장" : "세트 저장"}</Button> : null}
            {selected ? <Button variant="ghost" onClick={() => void remove()} disabled={Boolean(busy)}>{busy === "delete" ? "삭제 중…" : "삭제"}</Button> : null}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
