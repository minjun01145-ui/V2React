import TimedBuffHud from "../timed-buffs/TimedBuffHud.tsx";
import { PARTY_BUFF_DEFINITIONS, type ActiveBuff } from "./buffs.ts";

export default function BuffHud({ buffs }: { readonly buffs: readonly ActiveBuff[] }) {
  return <TimedBuffHud buffs={buffs} definitions={PARTY_BUFF_DEFINITIONS} />;
}
