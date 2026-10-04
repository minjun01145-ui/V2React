import { useEffect, useState } from "react";
import { getSlideShow, listSlideShows } from "../../../slide-show/repository.ts";
import type { SlideShow, SlideShowSummary } from "../../../slide-show/types.ts";
import { toErrorMessage } from "../../../shared/errors/errorMessage.ts";
import Field from "../../../shared/ui/Field.tsx";
import Select from "../../../shared/ui/Select.tsx";
import styles from "./SlideShowLaunchPanel.module.css";

export default function SlideShowLaunchPanel({ disabled, onShowChange }: {
  readonly disabled: boolean;
  readonly onShowChange: (show: SlideShow | null) => void;
}) {
  const [shows, setShows] = useState<readonly SlideShowSummary[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [loadingShow, setLoadingShow] = useState(false);

  useEffect(() => {
    let active = true;
    void listSlideShows().then((next) => {
      if (!active) return;
      setShows(next);
      setSelectedId((current) => current && next.some((show) => show.id === current) ? current : (next[0]?.id ?? ""));
    }).catch((value: unknown) => { if (active) setError(toErrorMessage(value, "슬라이드쇼 목록을 불러오지 못했습니다.")); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    onShowChange(null);
    if (!selectedId) return () => { active = false; };
    setLoadingShow(true);
    setError("");
    void getSlideShow(selectedId).then((show) => {
      if (active) onShowChange(show);
    }).catch((value: unknown) => {
      if (active) setError(toErrorMessage(value, "슬라이드쇼를 불러오지 못했습니다."));
    }).finally(() => { if (active) setLoadingShow(false); });
    return () => { active = false; };
  }, [onShowChange, selectedId]);

  return <div className={styles.showSetup}>
    <Field label="슬라이드쇼"><Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={disabled || loadingShow}>
      <option value="">{shows.length === 0 ? "저장된 슬라이드쇼가 없어요" : "슬라이드쇼 선택"}</option>
      {shows.map((show) => <option value={show.id} key={show.id}>{show.name} ({show.slideCount}장)</option>)}
    </Select></Field>
    {error ? <p className={styles.setError}>{error}</p> : null}
  </div>;
}
