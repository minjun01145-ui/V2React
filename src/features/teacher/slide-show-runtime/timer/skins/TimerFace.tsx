import type { CountdownTimer } from "../useCountdownTimer.ts";
import AppleFace from "./AppleFace.tsx";
import GlowFace from "./GlowFace.tsx";
import HourglassFace from "./HourglassFace.tsx";
import type { TimerSkin } from "./skins.ts";

/** The running timer drawn in the chosen skin. The plain skin keeps the panel's own digit editor. */
export default function TimerFace({ skin, timer }: { readonly skin: Exclude<TimerSkin, "normal">; readonly timer: CountdownTimer }) {
  const props = { remainingSeconds: timer.remainingSeconds, durationSeconds: timer.durationSeconds, finished: timer.finished };
  if (skin === "glow") return <GlowFace {...props} />;
  if (skin === "hourglass") return <HourglassFace {...props} running={timer.running} />;
  return <AppleFace {...props} />;
}
