# Game effects

`model.ts` turns game results into presentation-neutral effect definitions. `useGameEffectEngine` owns effect timing, and `GameEffectLayer` renders the current definition. A game only needs to call `play(createScoreCelebration(...))` after a saved correct answer, so scoring rules remain inside each game and visual effects remain reusable.

New effect families should be added to the model as definitions and rendered in the shared layer instead of adding game-specific overlays.
