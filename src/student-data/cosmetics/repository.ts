import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseClient.ts";
import { isCharacterId } from "../../characters/catalog.ts";
import {
  EMPTY_STUDENT_COSMETICS,
  type EquippedAvatar,
  type EquippedPokemonAvatar,
  type StudentCosmetics,
} from "./types.ts";

const cosmeticsDocument = (accountId: string) => doc(db, "studentGameData", accountId, "cosmetics", "profile");

function parseCosmetics(data: DocumentData | undefined): StudentCosmetics {
  if (!data) return EMPTY_STUDENT_COSMETICS;
  if (data.equippedKind === "pokemon"
    && typeof data.equippedPokemonCaptureId === "string"
    && typeof data.equippedPokemonName === "string"
    && typeof data.equippedPokemonSpriteUrl === "string") {
    return {
      equippedAvatar: {
        kind: "pokemon",
        captureId: data.equippedPokemonCaptureId,
        name: data.equippedPokemonName,
        spriteUrl: data.equippedPokemonSpriteUrl,
        fallbackSpriteUrl: typeof data.equippedPokemonFallbackSpriteUrl === "string"
          ? data.equippedPokemonFallbackSpriteUrl
          : null,
      },
    };
  }
  const characterId = isCharacterId(data.equippedCharacterId) ? data.equippedCharacterId : null;
  return {
    equippedAvatar: characterId ? { kind: "character", characterId } : null,
  };
}

export function subscribeStudentCosmetics(
  accountId: string,
  onValue: (cosmetics: StudentCosmetics) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    cosmeticsDocument(accountId),
    (snapshot) => onValue(parseCosmetics(snapshot.data())),
    onError,
  );
}

export async function equipCharacter(accountId: string, characterId: string): Promise<void> {
  if (!isCharacterId(characterId)) throw new Error("장착할 수 없는 캐릭터입니다.");
  await setDoc(cosmeticsDocument(accountId), {
    equippedKind: "character",
    equippedCharacterId: characterId,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

export async function equipPokemon(accountId: string, pokemon: EquippedPokemonAvatar): Promise<void> {
  if (!pokemon.captureId || !pokemon.name || !pokemon.spriteUrl.startsWith("https://")) {
    throw new Error("장착할 수 없는 포켓몬입니다.");
  }
  await setDoc(cosmeticsDocument(accountId), {
    equippedKind: "pokemon",
    equippedPokemonCaptureId: pokemon.captureId,
    equippedPokemonName: pokemon.name,
    equippedPokemonSpriteUrl: pokemon.spriteUrl,
    equippedPokemonFallbackSpriteUrl: pokemon.fallbackSpriteUrl,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

export function equippedAvatarKey(avatar: EquippedAvatar | null): string | null {
  if (!avatar) return null;
  return avatar.kind === "character" ? `character:${avatar.characterId}` : `pokemon:${avatar.captureId}`;
}
