import { useCallback, useEffect, useState } from "react";
import { listLearningSets } from "../../../learning-sets/readRepository.ts";
import type { LearningSetSummary } from "../../../learning-sets/types.ts";
import { deleteSlideShow, getSlideShow, listSlideShows, saveSlideShow } from "../../../slide-show/repository.ts";
import type { SlideShow, SlideShowSummary } from "../../../slide-show/types.ts";
import PageShell from "../../../shared/PageShell.tsx";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import { usePopup } from "../../../shared/popup/index.ts";
import Button from "../../../shared/ui/Button.tsx";
import SlideShowEditor, { newSlide, type SlideShowDraft } from "./SlideShowEditor.tsx";
import styles from "./TeacherSlideShowPage.module.css";

type OpenShow = { readonly saved: SlideShow | null; readonly draft: SlideShowDraft };

const dateFormat = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function TeacherSlideShowPage({ roomId }: { readonly roomId: string }) {
  const [shows, setShows] = useState<readonly SlideShowSummary[]>([]);
  const [sets, setSets] = useState<readonly LearningSetSummary[]>([]);
  const [open, setOpen] = useState<OpenShow | null>(null);
  // Remounts the editor whenever a different show (or a fresh one) is opened.
  const [editorKey, setEditorKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const { requestConfirmation } = usePopup();

  const refresh = useCallback(async (): Promise<void> => {
    const [nextShows, nextSets] = await Promise.all([listSlideShows(), listLearningSets()]);
    setShows(nextShows);
    setSets(nextSets);
  }, []);

  useEffect(() => { void refresh().catch((value: unknown) => setError(toErrorMessage(value, "슬라이드쇼 목록을 불러오지 못했습니다."))); }, [refresh]);

  const confirmDiscard = async (): Promise<boolean> => !dirty || requestConfirmation({
    title: "저장하지 않은 변경이 있어요",
    message: "지금 나가면 마지막 저장 이후의 변경은 사라집니다.",
    tone: "warning",
    confirmLabel: "저장하지 않고 나가기",
    cancelLabel: "계속 편집",
    blurBackground: true,
  });

  const openEditor = (next: OpenShow): void => {
    setOpen(next);
    setDirty(false);
    setEditorKey((key) => key + 1);
  };

  const createShow = async (): Promise<void> => {
    if (!(await confirmDiscard())) return;
    openEditor({ saved: null, draft: { name: "", slides: [newSlide()] } });
  };

  const loadShow = async (summary: SlideShowSummary): Promise<void> => {
    if (!(await confirmDiscard())) return;
    setBusy(true);
    setError("");
    try {
      const show = await getSlideShow(summary.id);
      openEditor({ saved: show, draft: { name: show.name, slides: show.slides } });
    } catch (value: unknown) {
      setError(toErrorMessage(value, "슬라이드쇼를 불러오지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const save = async (draft: SlideShowDraft): Promise<void> => {
    setBusy(true);
    try {
      const saved = open?.saved;
      const show = await saveSlideShow({
        ...(saved ? { id: saved.id, createdAtMs: saved.createdAtMs, previousSlideIds: saved.slides.map((slide) => slide.id) } : {}),
        name: draft.name,
        slides: draft.slides,
      });
      setOpen({ saved: show, draft });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = async (): Promise<void> => {
    if (!(await confirmDiscard())) return;
    setOpen(null);
    setDirty(false);
  };

  const remove = async (): Promise<void> => {
    const saved = open?.saved;
    if (!saved) return;
    const confirmed = await requestConfirmation({ title: `“${saved.name}” 슬라이드쇼를 삭제할까요?`, message: "모든 슬라이드가 함께 삭제됩니다. 학습 세트는 삭제되지 않습니다.", tone: "error", confirmLabel: "삭제", blurBackground: true });
    if (!confirmed) return;
    setBusy(true);
    try {
      await deleteSlideShow(saved);
      setOpen(null);
      setDirty(false);
      await refresh();
    } catch (value: unknown) {
      setError(toErrorMessage(value, "슬라이드쇼를 삭제하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const actions = open
    ? <><Button variant="ghost" onClick={() => void closeEditor()} disabled={busy}>목록</Button>{open.saved ? <Button variant="quiet" onClick={() => void remove()} disabled={busy}>삭제</Button> : null}</>
    : <Button variant="accent" onClick={() => void createShow()} disabled={busy}>새 슬라이드쇼</Button>;

  return <PageShell title="슬라이드쇼" width="wide" roomId={roomId} actions={actions}>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {open
      ? <SlideShowEditor key={editorKey} initial={open.draft} sets={sets} busy={busy} onSave={save} onDirtyChange={setDirty} />
      : shows.length === 0
        ? <p className={styles.empty}>아직 만든 슬라이드쇼가 없어요</p>
        : <div className={styles.grid}>{shows.map((show) => <button type="button" className={styles.card} key={show.id} onClick={() => void loadShow(show)} disabled={busy}>
          <span className={styles.cover} aria-hidden="true"><i /><i /><i /><b>{show.slideCount}장</b></span>
          <strong>{show.name}</strong>
          <span className={styles.date}>{dateFormat.format(show.updatedAtMs)}</span>
        </button>)}</div>}
  </PageShell>;
}
