export interface StudentCosmetics {
  readonly equippedCharacterId: string | null;
}

export const EMPTY_STUDENT_COSMETICS: StudentCosmetics = Object.freeze({
  equippedCharacterId: null,
});
