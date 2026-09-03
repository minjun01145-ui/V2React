export interface EquippedCharacterAvatar {
  readonly kind: "character";
  readonly characterId: string;
}

export interface EquippedPokemonAvatar {
  readonly kind: "pokemon";
  readonly captureId: string;
  readonly name: string;
  readonly spriteUrl: string;
  readonly fallbackSpriteUrl: string | null;
}

export type EquippedAvatar = EquippedCharacterAvatar | EquippedPokemonAvatar;

export interface StudentCosmetics {
  readonly equippedAvatar: EquippedAvatar | null;
}

export const EMPTY_STUDENT_COSMETICS: StudentCosmetics = Object.freeze({
  equippedAvatar: null,
});
