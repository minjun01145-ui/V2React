import type { TeacherView } from "./teacherRoute.ts";
import { TEACHER_VIEW, teacherHref } from "./teacherRoute.ts";
import BrandMark from "../../shared/ui/BrandMark.tsx";
import Button from "../../shared/ui/Button.tsx";
import { tenantHref, type TenantConfig } from "../../tenant/config.ts";
import { PRIMARY_TENANT_ID } from "../../tenant/scope.ts";
import styles from "./TeacherNav.module.css";

const mainItems: readonly { readonly view: TeacherView; readonly label: string }[] = [
  { view: TEACHER_VIEW.LOBBY, label: "대기실" },
  { view: TEACHER_VIEW.SETS, label: "학습 세트" },
  { view: TEACHER_VIEW.QUIZ_GAME, label: "퀴즈쇼 만들기" },
  { view: TEACHER_VIEW.STUDENTS, label: "학생 명단" },
];
const secondaryItems: readonly { readonly view: TeacherView; readonly label: string }[] = [
  { view: TEACHER_VIEW.AI, label: "AI 설정" },
  { view: TEACHER_VIEW.SETTINGS, label: "설정" },
];

interface Props {
  readonly currentView: TeacherView;
  readonly tenant: TenantConfig;
  readonly onLogout: () => Promise<void>;
}

export default function TeacherNav({ currentView, tenant, onLogout }: Props) {
  return (
    <nav className={styles.nav} aria-label="교사용 메뉴">
      <a className={styles.brand} href={tenantHref("/", tenant.id)} aria-label={`${tenant.brandAlt} 홈`}>
        <BrandMark className={styles.brandMark} tenant={tenant} />
      </a>
      <div className={styles.mainLinks}>
        {mainItems.map(({ view, label }) => (
          <a className={`${styles.link} ${currentView === view ? styles.active : ""}`} href={teacherHref(view)} aria-current={currentView === view ? "page" : undefined} key={view}>{label}</a>
        ))}
      </div>
      <div className={styles.secondaryLinks}>
        {secondaryItems.filter(({ view }) => view !== TEACHER_VIEW.AI || tenant.id === PRIMARY_TENANT_ID).map(({ view, label }) => (
          <a className={styles.secondaryLink} href={teacherHref(view)} aria-current={currentView === view ? "page" : undefined} key={view}>{label}</a>
        ))}
        <Button variant="onBrand" size="sm" onClick={() => void onLogout()}>로그아웃</Button>
      </div>
    </nav>
  );
}
