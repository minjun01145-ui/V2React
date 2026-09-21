/** Physical keys also work while a Korean input method is selected. */
export function movementAction(code: string, key: string): "left" | "right" | "jump" | null {
  switch (code || key) {
    case "ArrowLeft": case "KeyA": case "a": case "A": return "left";
    case "ArrowRight": case "KeyD": case "d": case "D": return "right";
    case "ArrowUp": case "Space": case "KeyW": case "w": case "W": case " ": return "jump";
    default: return null;
  }
}
