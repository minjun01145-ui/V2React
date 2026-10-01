import type Phaser from "phaser";

// The teacher test tool stacks several student frames in one browser and only
// shows one. Hidden frames still render at full speed, so the embedding app
// marks them with this attribute and Phaser games stop their loop meanwhile.
const ATTRIBUTE = "data-background-frame";

export function markBackgroundFrame(background: boolean): void {
  document.documentElement.toggleAttribute(ATTRIBUTE, background);
}

/** Sleeps the game loop while the page is marked as a background frame. Returns a disposer. */
export function pauseWhileBackgroundFrame(game: Phaser.Game): () => void {
  const root = document.documentElement;
  const apply = (): void => {
    if (!game.isBooted) return;
    if (root.hasAttribute(ATTRIBUTE)) game.loop.sleep();
    else game.loop.wake();
  };
  const observer = new MutationObserver(apply);
  observer.observe(root, { attributes: true, attributeFilter: [ATTRIBUTE] });
  game.events.once("ready", apply);
  apply();
  return () => observer.disconnect();
}
