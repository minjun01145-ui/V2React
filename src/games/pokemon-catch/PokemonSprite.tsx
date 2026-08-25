import { useEffect, useState } from "react";
export interface PokemonSpriteSource {
  readonly spriteUrl: string;
  readonly fallbackSpriteUrl: string | null;
}

export function PokemonSprite({ pokemon, className, alt }: {
  readonly pokemon: PokemonSpriteSource;
  readonly className?: string | undefined;
  readonly alt: string;
}) {
  const [source, setSource] = useState(pokemon.spriteUrl);

  useEffect(() => setSource(pokemon.spriteUrl), [pokemon.spriteUrl]);

  return <img
    className={className}
    src={source}
    alt={alt}
    onError={() => {
      if (pokemon.fallbackSpriteUrl && source !== pokemon.fallbackSpriteUrl) {
        setSource(pokemon.fallbackSpriteUrl);
      }
    }}
  />;
}
