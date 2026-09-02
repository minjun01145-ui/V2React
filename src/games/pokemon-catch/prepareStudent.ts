import type { StudentGamePreparationContext } from "../../game-engine/contracts/gameDefinition.ts";
import { pokemonCatchAccountId, warmPokemonCatchData } from "../../student-data/pokemon-catch/channel.ts";
import { encounterId } from "./encounterRules.ts";
import { fetchPokemonEncounter } from "./pokeApi.ts";

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("첫 포켓몬 이미지를 불러오지 못했습니다."));
    image.src = url;
  });
}

export default async function preparePokemonCatchStudent({ session, player }: StudentGamePreparationContext): Promise<() => void> {
  if (!session.roundId) throw new Error("포켓몬 게임 라운드 정보가 없습니다.");
  const accountId = await pokemonCatchAccountId(player.id, player.studentNumber);
  const dataRelease = await warmPokemonCatchData(accountId);
  try {
    const pokemon = await fetchPokemonEncounter(encounterId(`${session.roundId}:${player.id}:0`));
    try {
      await preloadImage(pokemon.spriteUrl);
    } catch {
      if (!pokemon.fallbackSpriteUrl) throw new Error("첫 포켓몬 이미지를 불러오지 못했습니다.");
      await preloadImage(pokemon.fallbackSpriteUrl);
    }
    return dataRelease;
  } catch (error: unknown) {
    dataRelease();
    throw error;
  }
}
