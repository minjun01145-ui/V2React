import { useClassroomNotice } from "../../../classroom-notice/useClassroomNotice.ts";
import styles from "./ClassroomNoticeBanner.module.css";

/** The teacher's notice at the top of the lobby, scrolling with it; nothing is shown while there is none. */
export default function ClassroomNoticeBanner({ roomId }: { readonly roomId: string }) {
  const { notice } = useClassroomNotice(roomId);
  const text = notice?.text.trim() ?? "";
  if (!text) return null;
  return <section className={styles.notice} aria-label="공지" data-lobby-notice="">
    <strong>공지</strong>
    <p>{text}</p>
  </section>;
}
