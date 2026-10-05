import { useEffect, useRef, useState } from "react";
import { AVATAR_CATEGORIES, CATEGORY_LABELS, type AvatarCategory } from "../../../characters/appearance.ts";
import { loadNextCharacterShop, updateNextCharacterShop, type CharacterShopItem, type NextCharacterShopData } from "../../../student-data/cosmetics/shopRepository.ts";
import Button from "../../../shared/ui/Button.tsx";
import Card from "../../../shared/ui/Card.tsx";
import CharacterItemIcon from "../../../shared/ui/CharacterItemIcon.tsx";
import styles from "./CharacterShopManagement.module.css";

function ItemEditor({ item, data, busy, onSave }: { readonly item: CharacterShopItem; readonly data: NextCharacterShopData; readonly busy: boolean; readonly onSave: (itemId: number, mode: "auto" | "exclude" | "feature", price: number | null) => void }) {
  const mode = data.next.excludedIds.includes(item.itemId) ? "exclude" : data.next.forcedIds.includes(item.itemId) ? "feature" : "auto";
  const savedPrice = data.next.prices[item.itemId] ?? item.price;
  const [price, setPrice] = useState(String(savedPrice));
  const [selection, setSelection] = useState<"auto" | "exclude" | "feature">(mode);
  useEffect(() => { setPrice(String(savedPrice)); setSelection(mode); }, [savedPrice, mode]);
  return <form className={styles.item} onSubmit={(event) => { event.preventDefault(); onSave(item.itemId, selection, Number(price)); }}>
    <div className={styles.icon}><CharacterItemIcon itemId={item.itemId} category={item.category} /></div>
    <strong>{item.name}</strong>
    <span>{CATEGORY_LABELS[item.category]} · #{item.itemId}</span>
    <select aria-label={`${item.name} 신상 지정`} value={selection} disabled={busy} onChange={(event) => setSelection(event.target.value as typeof selection)}>
      <option value="auto">자동 선정</option><option value="feature">신상 지정</option><option value="exclude">신상 제외</option>
    </select>
    <label>가격<input type="number" min="1" max="10000" step="1" required disabled={busy} value={price} onChange={(event) => setPrice(event.target.value)} /></label>
    <div className={styles.actions}><Button type="submit" size="sm" disabled={busy}>{busy ? "저장 중…" : "저장"}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => onSave(item.itemId, "auto", null)}>변경 취소</Button></div>
  </form>;
}
export default function CharacterShopManagement() {
  const [data, setData] = useState<NextCharacterShopData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [category, setCategory] = useState<AvatarCategory>("hat");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    setMessage(null);
    void loadNextCharacterShop().then((value) => { if (active) setData(value); }).catch((error: unknown) => { if (active) setMessage(error instanceof Error ? error.message : "신상을 불러오지 못했습니다."); });
    return () => { active = false; };
  }, [refresh]);
  const save = async (itemId: number, mode: "auto" | "exclude" | "feature", price: number | null) => {
    if (!data || pending.current) return;
    pending.current = true; setBusy(true); setMessage(null);
    try { setData(await updateNextCharacterShop(data.next.week, itemId, mode, price)); setMessage("다음 주 신상 설정을 저장했습니다."); }
    catch (error: unknown) { setMessage(error instanceof Error ? error.message : "신상 설정을 저장하지 못했습니다."); }
    finally { pending.current = false; setBusy(false); }
  };
  const renderItem = (item: CharacterShopItem) => data ? <ItemEditor key={item.itemId} item={item} data={data} busy={busy} onSave={(id, mode, price) => void save(id, mode, price)} /> : null;
  const filtered = data?.items.filter((item) => item.onSale && item.category === category) ?? [];
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  return <Card className={styles.management}>
    <header><h2>다음 주 신상{data ? ` · ${data.next.week}` : ""}</h2><Button size="sm" variant="ghost" disabled={busy} onClick={() => setRefresh((value) => value + 1)}>새로고침</Button></header>
    {message ? <p role="status">{message}</p> : null}
    {!data && !message ? <p role="status">신상을 불러오는 중…</p> : null}
    {data ? <>
      <div className={styles.grid}>{data.nextFeaturedIds.map((id) => data.items.find((item) => item.itemId === id)).filter((item): item is CharacterShopItem => Boolean(item)).map(renderItem)}</div>
      <h3>판매 아이템</h3>
      <div className={styles.categories}>{AVATAR_CATEGORIES.map((slot) => <button type="button" key={slot} aria-pressed={category === slot} onClick={() => { setCategory(slot); setPage(0); }}>{CATEGORY_LABELS[slot]}</button>)}</div>
      <div className={styles.grid}>{filtered.slice(page * 8, (page + 1) * 8).map(renderItem)}</div>
      <nav className={styles.pagination} aria-label="판매 아이템 페이지"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button><span>{page + 1} / {pages}</span><Button size="sm" variant="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>다음</Button></nav>
    </> : null}
  </Card>;
}
