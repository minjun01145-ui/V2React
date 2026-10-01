import type Phaser from "phaser";

// The teacher test tool stacks several student frames in one browser and only
// shows one. Drawing every hidden frame is wasted work, so the embedding app
// marks hidden frames with this attribute and their games stop rendering.
// The loop itself keeps running: physics, punches received from others and
// position publishing must continue, or a hidden student would freeze.
const ATTRIBUTE = "data-background-frame";

export function markBackgroundFrame(background: boolean): void {
  document.documentElement.toggleAttribute(ATTRIBUTE, background);
}

/** Skips rendering (but not updating) while the page is a background frame. Returns a disposer. */
export function pauseWhileBackgroundFrame(game: Phaser.Game): () => void {
  const root = document.documentElement;
  // Checked every step because a scene that starts later resets itself to visible.
  const sync = (): void => {
    const visible = !root.hasAttribute(ATTRIBUTE);
    for (const scene of game.scene.getScenes(false)) {
      if (scene.sys.isVisible() !== visible) scene.sys.setVisible(visible);
    }
  };
  game.events.on("poststep", sync);
  return () => {
    game.events.off("poststep", sync);
  };
}
