import TimerFace from "../../slide-show-runtime/timer/skins/TimerFace.tsx";
import type { TimerSnapshot } from "../../../slide-show/timer.ts";
import type { TimerSkin } from "../../../slide-show/timerSkins.ts";
import styles from "./EngineTimerFace.module.css";

export default function EngineTimerFace({ skin, timer }: { readonly skin: TimerSkin; readonly timer: TimerSnapshot }) {
  return <div className={styles.slot}><div className={styles.face} data-skin={skin}><TimerFace skin={skin} timer={timer} /></div></div>;
}
