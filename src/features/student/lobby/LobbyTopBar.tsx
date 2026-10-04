import Button from "../../../shared/ui/Button.tsx";
import styles from "./LobbyTopBar.module.css";
export default function LobbyTopBar({ leaving, onLeave }: { readonly leaving: boolean; readonly onLeave: () => void }) {
  return <header className={styles.bar}><h1>대기실</h1><Button variant="onBrand" size="sm" disabled={leaving} onClick={onLeave}>{leaving ? "나가는 중…" : "다른 학생으로 로그인"}</Button></header>;
}
