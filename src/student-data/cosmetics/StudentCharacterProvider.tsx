import { createContext, useContext, type ReactNode } from "react";
import { useStudentCosmetics } from "./useStudentCosmetics.ts";

const Context = createContext<ReturnType<typeof useStudentCosmetics> | null>(null);
export function StudentCharacterProvider({ identity, children }: { readonly identity: { readonly uid: string; readonly studentNumber: string }; readonly children: ReactNode }) {
  const data = useStudentCosmetics(identity);
  return <Context.Provider value={data}>{children}</Context.Provider>;
}
export function useStudentCharacter() {
  const data = useContext(Context);
  if (!data) throw new Error("학생 캐릭터 공급자가 없습니다.");
  return data;
}
