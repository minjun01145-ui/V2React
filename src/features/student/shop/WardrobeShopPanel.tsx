import { useEffect, useRef, useState } from "react";
import { AVATAR_CATEGORIES, CATEGORY_LABELS, type AvatarCategory, type CharacterAppearance } from "../../../characters/appearance.ts";
import { previewCharacterItem } from "../../../characters/maple.ts";
import { useStudentCharacter } from "../../../student-data/cosmetics/StudentCharacterProvider.tsx";
import { loadCharacterShop, purchaseCharacterItem, type CharacterShopData, type CharacterShopItem } from "../../../student-data/cosmetics/shopRepository.ts";
import Avatar from "../../../shared/ui/Avatar.tsx";
import CharacterItemIcon from "../../../shared/ui/CharacterItemIcon.tsx";
import Button from "../../../shared/ui/Button.tsx";
import styles from "./WardrobeShopPanel.module.css";

const PAGE_SIZE = 16;
export default function WardrobeShopPanel() {
  const { wardrobe, balance, loading, error, saveAppearance, reload } = useStudentCharacter();
  const [shop, setShop] = useState<CharacterShopData | null>(null);
  const [shopError, setShopError] = useState<Error | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState<CharacterAppearance | null>(wardrobe?.appearance ?? null);
  const [category, setCategory] = useState<AvatarCategory>("hair");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<readonly number[]>([]);
  useEffect(() => { if (!draft && wardrobe) setDraft(wardrobe.appearance); }, [draft, wardrobe]);
  useEffect(() => {
    let active = true;
    setShopError(null);
    void loadCharacterShop().then((value) => { if (active) setShop(value); }).catch((reason: unknown) => {
      if (active) setShopError(reason instanceof Error ? reason : new Error("상점을 불러오지 못했습니다."));
    });
    return () => { active = false; };
  }, [refresh]);
  const ownedIds = new Set([...(wardrobe?.ownedItemIds ?? []), ...purchasedIds]);
  const coins = balance;
  const missing = draft ? Object.values(draft.items).filter((id): id is number => id !== null && !ownedIds.has(id)) : [];
  const filtered = shop?.items.filter((item) => item.category === category && (ownedOnly ? ownedIds.has(item.itemId) : item.onSale || ownedIds.has(item.itemId))
    && `${item.name} ${item.itemId}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? [];
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const select = (item: CharacterShopItem) => { if (draft) setDraft(previewCharacterItem(draft, item.category, item.itemId)); };
  const buy = async (item: CharacterShopItem) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage(null);
    try {
      const result = await purchaseCharacterItem(item);
      setPurchasedIds(result.ownedItemIds);
      setDraft((previous) => previous ? previewCharacterItem(previous, item.category, item.itemId) : previous);
      setMessage(result.purchased ? `${item.name} 구매 완료` : "이미 보유한 아이템입니다.");
    } catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "구매하지 못했습니다."); setRefresh((value) => value + 1); }
    finally { pending.current = false; setBusy(false); }
  };
  const save = async () => {
    if (!draft || pending.current || missing.length) return;
    pending.current = true; setBusy(true); setMessage(null);
    try { await saveAppearance(draft); setMessage("캐릭터를 저장했습니다."); }
    catch (reason: unknown) { setMessage(reason instanceof Error ? reason.message : "캐릭터를 저장하지 못했습니다."); }
    finally { pending.current = false; setBusy(false); }
  };
  const itemCard = (item: CharacterShopItem) => {
    const owned = ownedIds.has(item.itemId);
    const selected = draft?.items[item.category] === item.itemId;
    return <article className={styles.item} data-selected={selected || undefined} key={item.itemId}>
      <button type="button" className={styles.select} aria-label={`${item.name} 미리보기`} aria-pressed={selected} disabled={!draft || busy} onClick={() => select(item)}>
        <CharacterItemIcon itemId={item.itemId} category={item.category} /><strong>{item.name}</strong>
      </button>
      <span className={styles.price}>{owned ? "보유" : `${item.price} V2코인`}</span>
      {owned ? <Button size="sm" variant="ghost" disabled={!draft || busy || selected} onClick={() => select(item)}>{selected ? "선택됨" : "착용"}</Button>
        : <Button size="sm" disabled={loading || Boolean(error) || busy || coins === null || coins < item.price || !item.onSale} onClick={() => void buy(item)}>{busy ? "처리 중…" : coins !== null && coins < item.price ? "V2코인 부족" : "구매"}</Button>}
    </article>;
  };
  return <div className={styles.panel}>
    {error ? <div className={styles.notice} role="alert">{error.message} <Button size="sm" onClick={reload}>다시 불러오기</Button></div> : null}
    {shopError ? <div className={styles.notice} role="alert">{shopError.message} <Button size="sm" onClick={() => setRefresh((value) => value + 1)}>상점 새로고침</Button></div> : null}
    {message ? <p className={styles.notice} role="status">{message}</p> : null}
    <aside className={styles.preview}>
      <div className={styles.previewHeading}><h3>내 캐릭터</h3><strong>{coins === null ? "잔액 확인 중…" : `${coins} V2코인`}</strong></div>
      <div className={styles.avatar}><Avatar eager showStatus avatar={draft ? { kind: "maple", appearance: draft } : null} label="내 캐릭터 미리보기" /></div>
      <div className={styles.slots}>{AVATAR_CATEGORIES.map((slot) => <button type="button" key={slot} aria-pressed={category === slot} onClick={() => { setCategory(slot); setPage(0); }}>
        <span>{CATEGORY_LABELS[slot]}</span><strong>{shop?.items.find((item) => item.itemId === draft?.items[slot])?.name ?? (draft?.items[slot] ? `#${draft.items[slot]}` : "없음")}</strong>
      </button>)}</div>
      {["hat", "accessory", "weapon"].includes(category) ? <Button size="sm" variant="ghost" disabled={!draft || busy || draft.items[category] === null} onClick={() => draft && setDraft(previewCharacterItem(draft, category, null))}>{CATEGORY_LABELS[category]} 벗기</Button> : null}
      {missing.length > 0 ? <div className={styles.missing}>{missing.map((id) => {
        const item = shop?.items.find((entry) => entry.itemId === id);
        return item ? <Button size="sm" key={id} disabled={busy || loading || Boolean(error) || coins === null || coins < item.price} onClick={() => void buy(item)}>{coins !== null && coins < item.price ? "V2코인 부족" : `${item.name} 구매 · ${item.price}`}</Button> : null;
      })}</div> : null}
      <Button full disabled={loading || Boolean(error) || !draft || busy || missing.length > 0} onClick={() => void save()}>{busy ? "처리 중…" : missing.length ? `미보유 ${missing.length}개 구매 필요` : "캐릭터 저장"}</Button>
      <Button full variant="ghost" disabled={busy || !wardrobe} onClick={() => { if (wardrobe) setDraft(wardrobe.appearance); setMessage(null); }}>저장한 코디로 되돌리기</Button>
    </aside>
    <div className={styles.store}>
      {!shop && !shopError ? <p role="status">상점을 불러오는 중…</p> : null}
      {shop ? <>
        <section aria-labelledby="weekly-new-title"><h3 id="weekly-new-title">이번 주 신상</h3><div className={styles.weekly}>{shop.featuredIds.map((id) => shop.items.find((item) => item.itemId === id)).filter((item): item is CharacterShopItem => Boolean(item)).map(itemCard)}</div></section>
        <div className={styles.filters}>
          <div className={styles.tabs}><button type="button" aria-pressed={!ownedOnly} onClick={() => { setOwnedOnly(false); setPage(0); }}>상점</button><button type="button" aria-pressed={ownedOnly} onClick={() => { setOwnedOnly(true); setPage(0); }}>보유 아이템</button></div>
          <input type="search" aria-label="아이템 검색" placeholder="아이템 검색" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        </div>
        <div className={styles.categories} aria-label="아이템 카테고리">{AVATAR_CATEGORIES.map((slot) => <button type="button" key={slot} aria-pressed={category === slot} onClick={() => { setCategory(slot); setPage(0); }}>{CATEGORY_LABELS[slot]}</button>)}</div>
        <div className={styles.grid}>{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(itemCard)}</div>
        {filtered.length === 0 ? <p className={styles.empty}>아이템이 없습니다.</p> : null}
        <nav className={styles.pagination} aria-label="아이템 페이지"><Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>이전</Button><span>{currentPage + 1} / {pages}</span><Button size="sm" variant="ghost" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>다음</Button></nav>
      </> : null}
    </div>
  </div>;
}
