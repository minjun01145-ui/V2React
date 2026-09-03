import type { TeacherView } from "./teacherRoute.ts";
import { TEACHER_VIEW, teacherHref } from "./teacherRoute.ts";
import BrandMark from "../../shared/ui/BrandMark.tsx";
import styles from "./TeacherNav.module.css";

const items: readonly { readonly view: TeacherView; readonly label: string }[] = [
  { view: TEACHER_VIEW.DASHBOARD, label: "관리자 홈" },
  { view: TEACHER_VIEW.LOBBY, label: "게임 대기실" },
  { view: TEACHER_VIEW.STUDENTS, label: "학생 관리" },
  { view: TEACHER_VIEW.SETS, label: "학습 세트" },
  { view: TEACHER_VIEW.QUIZ_GAME, label: "퀴즈게임" },
  { view: TEACHER_VIEW.AI, label: "AI API" },
  { view: TEACHER_VIEW.TEST_TOOL, label: "테스트 툴" },
  { view: TEACHER_VIEW.SETTINGS, label: "설정" },
];

interface Props {
  readonly currentView: TeacherView;
  readonly onLogout: () => Promise<void>;
}

export default function TeacherNav({ currentView, onLogout }: Props) {
  return (
    <nav className={styles.nav} aria-label="교사용 메뉴">
      <a className={styles.brand} href="/" aria-label="Jurye 홈">
        <BrandMark className={styles.brandMark} />
        <strong>관리자 페이지</strong>
      </a>
      <div className={styles.links}>
        {items.map(({ view, label }) => (
          <a className={`${styles.link} ${currentView === view ? styles.active : ""}`} href={teacherHref(view)} aria-current={currentView === view ? "page" : undefined} key={view}>{label}</a>
        ))}
        <button className={styles.logout} type="button" onClick={() => void onLogout()}>로그아웃</button>
      </div>
    </nav>
  );
}
