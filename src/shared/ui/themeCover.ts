import type { ThemeId } from "../../appearance/themes.ts";

// Small vector illustrations stay sharp on classroom projectors and need no remote assets.
const symbols = {
  tower: '<path d="M110 130h100v18H110zm12-28h76v18h-76zm14-28h48v18h-48zm14-28h20v18h-20z"/>',
  keyboard: '<rect x="92" y="66" width="136" height="80" rx="8"/><path d="M106 84h108M106 103h108M120 124h80" fill="none" stroke="var(--detail)" stroke-width="8" stroke-dasharray="12 6"/>',
  cards: '<rect x="104" y="52" width="70" height="100" rx="6" transform="rotate(-12 139 102)"/><rect x="152" y="54" width="70" height="100" rx="6" stroke="var(--detail)" stroke-width="5"/><path d="m187 78 16 25-16 25-16-25z" fill="var(--detail)"/>',
  battle: '<path d="m113 48 18 5 67 80-13 12-66-79zm94 0-18 5-67 80 13 12 66-79z"/><path d="m104 127 33 28m46 0 33-28" fill="none" stroke="var(--detail)" stroke-width="10"/>',
  quiz: '<path d="M133 75q0-27 29-27t29 27q0 15-21 27v16h-22V94q22-8 22-19 0-9-9-9t-9 9z"/><rect x="148" y="132" width="23" height="23"/>',
  robot: '<rect x="108" y="65" width="104" height="79" rx="12"/><path d="M160 45v20M92 85v39m136-39v39" fill="none" stroke="currentColor" stroke-width="10"/><path d="M130 89v17m60-17v17m-54 19h48" fill="none" stroke="var(--detail)" stroke-width="10"/>',
  blocks: '<path d="M88 105h44v39H88zm50 0h44v39h-44zm50 0h44v39h-44zM113 60h44v39h-44zm50 0h44v39h-44z"/>',
  rain: '<path d="M102 89q-10-32 24-32 18-33 46-8 40-10 47 23 15 29-20 29h-83z"/><path d="m123 113-10 22m48-22-10 22m48-22-10 22" fill="none" stroke="currentColor" stroke-width="9"/>',
  shirt: '<path d="m134 52-44 25 19 35 20-10v48h62v-48l20 10 19-35-44-25q-26 30-52 0z"/>',
  brush: '<path d="m190 43 22 17-55 65-22-17zM133 114q-38-2-30 43 18-13 30-10 32-4 17-23z"/>',
  skate: '<path d="M115 53h45v47l43 15v26H99v-23l16-18z"/><path d="M90 159h130m-103-18v18m73-18v18" fill="none" stroke="currentColor" stroke-width="8"/>',
  fruit: '<path d="M99 83h122q-2 70-61 70T99 83z"/><path d="m128 99 6 13m26-13v15m26-15-6 13" fill="none" stroke="var(--detail)" stroke-width="7"/><path d="m183 47 25 17-78 53-7-9z"/>',
  ball: '<circle cx="160" cy="103" r="51"/><path d="M109 103h102" stroke="var(--detail)" stroke-width="9"/><circle cx="160" cy="103" r="17" fill="var(--detail)"/>',
  puzzle: '<path d="M105 57h43q-10 28 13 28t13-28h40v40q-28-10-28 13t28 13v32h-40q10-28-13-28t-13 28h-43v-32q28 10 28-13t-28-13z"/>',
  headset: '<path d="M108 113V94a52 52 0 0 1 104 0v19" fill="none" stroke="currentColor" stroke-width="15"/><rect x="100" y="101" width="28" height="48" rx="9"/><rect x="192" y="101" width="28" height="48" rx="9"/>',
} as const;
const gameSymbols: Record<string, keyof typeof symbols> = {
  "typing-escape": "keyboard", "typing": "keyboard", "ai-tutor": "robot", "pokemon-catch": "ball",
  "sentence-builder": "puzzle", "cooperative-sentence-builder": "puzzle", "one-on-one-battle": "battle",
  "word-uno": "cards", "simple-quiz": "quiz", "acid-rain": "rain", "matching": "cards", "matching-all": "cards",
  "meaning-dash": "skate", "brick-smash": "blocks", "word-ninja": "fruit", "chunk-line-up": "blocks",
  "chunk-jump-race": "tower", "learning-jump-tower": "tower", "lobby-platformer": "tower",
  "lobby-deathmatch": "battle", "word-deathmatch": "battle", "solo": "headset", "drawing": "brush", "character-shop": "shirt",
};

const pixels: Record<keyof typeof symbols, readonly string[]> = {
  tower: ["......##......", "......##......", ".....####.....", ".....#..#.....", "....######....", "....#....#....", "...########...", "...#......#...", "..##########..", "..#..#..#..#..", "..##########.."],
  keyboard: [".############.", "##..........##", "#.#.#.#.#.#..#", "#............#", "#..#.#.#.#.#.#", "#............#", "#.#.######.#.#", "##..........##", ".############."],
  cards: ["..######......", ".##....##.....", ".#..#..######.", "##.###.#....#.", "#...#..#..#.#.", "#.....##.####.", "#######...#.#.", "......#.....#.", "......#######."],
  battle: ["##..........##", ".##........##.", "..##......##..", "...##....##...", "....##..##....", ".....####.....", "...##.##.##...", "..#..####..#..", "...###..###...", "..##......##.."],
  quiz: ["...######...", "..##....##..", "..##....##..", ".......###..", "......###...", ".....###....", ".....##.....", "............", ".....##.....", ".....##....."],
  robot: ["......##......", "......##......", "..##########..", "..#........#..", "###.##..##.###", "#.#.##..##.#.#", "#.#........#.#", "..#.######.#..", "..#........#..", "..##########.."],
  blocks: ["...########...", "...#......#...", "...########...", ".############.", ".#....##....#.", ".############.", "##############", "#..##....##..#", "##############"],
  rain: [".....####.....", "...###..###...", "..##......##..", ".##........##.", "##..........##", ".############.", "..............", "..##..##..##..", "..#...#...#...", ".#...#...#...."],
  shirt: ["...##....##...", "..###....###..", ".#####..#####.", "#####.##.#####", "###........###", "..#........#..", "..#........#..", "..#........#..", "..#........#..", "..##########.."],
  brush: ["..........###.", ".........####.", "........####..", ".......####...", "......####....", ".....####.....", "...####.......", "..#####.......", ".######.......", "#######......."],
  skate: ["...#####......", "...#...#......", "...#.###......", "...#...#......", "...#.###......", "..##...####...", ".##.......###.", ".############.", "...##....##...", "##############"],
  fruit: [".############.", ".############.", ".#..#..#..#.#.", ".#..........#.", "..#..#..#..#..", "..#........#..", "...##....##...", "....######...."],
  ball: ["....######....", "..###....###..", ".##........##.", "##....##....##", "##############", "##....##....##", ".##........##.", "..###....###..", "....######...."],
  puzzle: [".....###......", ".....###......", "..##########..", "..#........#..", "###........###", "###........###", "..#........#..", "..####..####..", ".....#..#.....", ".....####....."],
  headset: ["....######....", "..###....###..", ".##........##.", ".#..........#.", "##..........##", "###........###", "###........###", "###........###", ".##........##."],
};

function pixelSymbol(kind: keyof typeof symbols): string {
  return pixels[kind].flatMap((row, y) => [...row].flatMap((cell, x) => cell === "#" ? [`<rect x="${104 + x * 8}" y="${48 + y * 8}" width="8" height="8"/>`] : [])).join("");
}

export function themeCover(key: string, theme: ThemeId): string {
  const kind = gameSymbols[key] ?? "puzzle";
  const symbol = theme === "arcade" ? pixelSymbol(kind) : symbols[kind];
  let art: string;
  if (theme === "arcade") {
    art = `<rect width="320" height="200" fill="#9eae82"/><path d="M0 160h320M0 180h320M40 160 0 200m90-40-20 40m70-40v40m50-40 20 40m30-40 40 40" stroke="#7a8d64"/><path d="M24 30h12v12H24zm250 21h8v8h-8zM46 98h8v8h-8zm214 26h12v12h-12z" fill="#d2d9ad"/><path d="M12 12h55m-55 0v35m296-35h-55m55 0v35" stroke="#32482e" stroke-width="4"/><g fill="#32482e" color="#32482e" style="--detail:#9eae82" shape-rendering="crispEdges">${symbol}</g>`;
  } else if (theme === "paper") {
    art = `<rect width="320" height="200" fill="#eae0cc"/><path d="M0 30h320M0 60h320M0 90h320M0 120h320M0 150h320M0 180h320" stroke="#d7cbb7"/><path d="m69 23 186 10-8 148-178-8-9-21 8-22-7-22 7-22z" fill="#fffaf0" transform="rotate(-4 160 100)"/><path d="m110 18 90 5-3 22-91-6z" fill="#d4b975" opacity=".75"/><g fill="#3b7465" color="#3b7465" style="--detail:#fffaf0" transform="rotate(-7 160 100)">${symbol}</g><path d="m250 142 17 5-8 28-16-5z" fill="#c77960"/>`;
  } else if (theme === "space") {
    art = `<rect width="320" height="200" fill="#101a25"/><circle cx="268" cy="26" r="68" fill="#304957"/><ellipse cx="265" cy="30" rx="89" ry="18" fill="none" stroke="#728b94" stroke-width="6" transform="rotate(-25 265 30)"/><path d="M30 35h4m30 110h4m207 22h4M246 90h4M88 21h4" stroke="#edf6ff" stroke-width="4"/><ellipse cx="160" cy="170" rx="75" ry="10" fill="#24375b"/><g fill="#d7e8e6" color="#d7e8e6" style="--detail:#233d4b" stroke-linejoin="round" stroke-linecap="round">${symbol}</g><circle cx="160" cy="100" r="82" fill="none" stroke="#5c8db0" stroke-dasharray="2 8"/>`;
  } else {
    art = `<rect width="320" height="200" fill="#e7ebff"/><circle cx="160" cy="100" r="77" fill="#fff"/><g fill="#2338b8" color="#2338b8" style="--detail:#fff">${symbol}</g>`;
  }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">${art}</svg>`)}`;
}
