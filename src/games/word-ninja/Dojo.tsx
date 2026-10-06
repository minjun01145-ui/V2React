import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import { NINJA_ITEMS, type NinjaDetails, type NinjaItemKind, type NinjaQuestion } from "./model.ts";
import type { NinjaSound } from "./useNinjaSound.ts";
import styles from "./WordNinja.module.css";

const SKINS = ["persimmon", "plum", "pear", "melon", "grape"] as const;
type Skin = (typeof SKINS)[number];
const JUICE: Record<Skin | "golden" | "miss" | NinjaItemKind, readonly string[]> = {
  persimmon: ["#e8682a", "#f59a4a", "#b8441a"],
  plum: ["#9b2f4f", "#c4566f", "#6e1d36"],
  pear: ["#d9c45a", "#efe08c", "#a99430"],
  melon: ["#5e9a52", "#9cc77f", "#3d6e35"],
  grape: ["#5b4a8a", "#8473b4", "#3a2d61"],
  golden: ["#d4a017", "#f1d27a", "#9c7208", "#1b1712"],
  miss: ["#3a342b", "#6d6455", "#1b1712"],
  frenzy: ["#c8361d", "#f2d14b", "#1b1712"],
  curse: ["#2b2440", "#5a4f7a", "#c8361d"],
};
const JUDGMENT = { perfect: "완벽", great: "좋아", good: "베기" } as const;

const TRAIL_MS = 190;
const LAUNCH_DELAY_MS = 420;
const CHAIN_MS = 280;
const STAIN_MS = 2_600;

interface Fruit {
  readonly key: number;
  /** The question this fruit was thrown for, decoys included. */
  readonly wave: NinjaQuestion;
  readonly waveId: number;
  readonly optionId: string;
  readonly text: string;
  readonly label: number;
  readonly skin: Skin;
  readonly golden: boolean;
  /** Item talismans grant a timed effect instead of answering. */
  readonly item: NinjaItemKind | null;
  readonly r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  phase: number;
  launchAt: number;
  state: "waiting" | "flying" | "sliced" | "dropped";
}

type FruitLook = Pick<Fruit, "text" | "skin" | "golden" | "item">;
interface Half { readonly id: number; readonly x: number; readonly y: number; readonly r: number; readonly angle: number; readonly fruit: FruitLook; readonly correct: boolean }
interface Popup { readonly id: number; readonly x: number; readonly y: number; readonly title: string; readonly score: number | null; readonly tone: string; readonly chain: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface Stain { readonly x: number; readonly y: number; readonly color: string; readonly born: number; readonly blobs: readonly (readonly [number, number, number])[] }
interface Slash { readonly x: number; readonly y: number; readonly angle: number; readonly length: number; readonly born: number }
interface TrailPoint { readonly x: number; readonly y: number; readonly t: number }

export interface DojoSliceContext {
  readonly elapsedMs: number;
  readonly golden: boolean;
  /** Answer fruit of the same wave still in play besides this one. */
  readonly remaining: number;
}

const labelSize = (text: string) => text.length <= 5 ? 1 : text.length <= 9 ? 0.82 : text.length <= 15 ? 0.68 : 0.56;

function FruitBody({ fruit, label }: { readonly fruit: FruitLook; readonly label?: number | undefined }) {
  if (fruit.item) return <span className={styles.talismanText}>{NINJA_ITEMS[fruit.item].label}</span>;
  return <>
    <i className={styles.stem} aria-hidden="true" />
    {label !== undefined && <kbd className={styles.key}>{label}</kbd>}
    <span className={styles.sticker} style={{ "--size": labelSize(fruit.text) } as CSSProperties}>{fruit.text}</span>
  </>;
}

/** Shortest distance from (px, py) to the segment a→b. */
function segmentDistance(px: number, py: number, a: TrailPoint, b: TrailPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.min(Math.max(((px - a.x) * dx + (py - a.y) * dy) / length, 0), 1) : 0;
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export default function Dojo({ question, waveKey, golden, item, active, fever, frenzy, onSlice, onItem, playSound }: {
  readonly question: NinjaQuestion;
  /** Changes whenever a new question should be tossed. */
  readonly waveKey: number;
  readonly golden: boolean;
  /** Talisman thrown along with a fresh wave. */
  readonly item: NinjaItemKind | null;
  readonly active: boolean;
  readonly fever: boolean;
  readonly frenzy: boolean;
  readonly onSlice: (wave: NinjaQuestion, optionId: string, context: DojoSliceContext) => AnswerResult<NinjaDetails> | null;
  readonly onItem: (kind: NinjaItemKind) => void;
  readonly playSound: (sound: NinjaSound) => void;
}) {
  const arena = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stainCanvas = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 800, h: 500 });
  const fruits = useRef<Fruit[]>([]);
  const elements = useRef(new Map<number, HTMLDivElement>());
  const particles = useRef<Particle[]>([]);
  const stains = useRef<Stain[]>([]);
  const slashes = useRef<Slash[]>([]);
  const trail = useRef<TrailPoint[]>([]);
  const swiping = useRef(false);
  const waveStart = useRef(0);
  const waveId = useRef(0);
  /** Physics pauses for a beat on a clean cut, which is most of what makes it feel heavy. */
  const freezeUntil = useRef(0);
  const chain = useRef({ count: 0, at: 0 });
  /** The current question was answered, so a fallen wave must not be thrown again. */
  const answered = useRef(false);
  const serial = useRef(0);
  const [wave, setWave] = useState<readonly Fruit[]>([]);
  const [halves, setHalves] = useState<Half[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const latest = useRef({ question, golden, item, active, fever, frenzy, onSlice, onItem, playSound });
  latest.current = { question, golden, item, active, fever, frenzy, onSlice, onItem, playSound };

  useLayoutEffect(() => {
    const element = arena.current;
    if (!element) return undefined;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      size.current = { w: Math.max(rect.width, 1), h: Math.max(rect.height, 1) };
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      for (const target of [canvas.current, stainCanvas.current]) {
        if (!target) continue;
        target.width = Math.round(size.current.w * ratio);
        target.height = Math.round(size.current.h * ratio);
        target.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Throws the current question's options up from below the arena, one fruit per option. */
  const toss = (fresh: boolean) => {
    const { question: current, golden: goldenWave, item: talisman } = latest.current;
    const { w, h } = size.current;
    const count = current.options.length;
    const r = Math.min(Math.max(Math.min(w / (count * 2.5), h * 0.16), 38), 92);
    const now = performance.now();
    const id = ++waveId.current;
    if (fresh) {
      waveStart.current = now + LAUNCH_DELAY_MS;
      answered.current = false;
    }
    const order = current.options.map((_, index) => index).sort(() => Math.random() - 0.5);
    const launch = (x: number, apexShare: number) => {
      const startY = h + r;
      const apex = h * apexShare;
      const rise = 1.3 + Math.random() * 0.25;
      const g = 2 * (startY - apex) / (rise * rise);
      return { x, y: startY, vx: (w / 2 - x) * 0.05 + (Math.random() - 0.5) * 40, vy: -g * rise, g, phase: Math.random() * 6 };
    };
    const next = current.options.map((option, index): Fruit => ({
      key: ++serial.current, wave: current, waveId: id, optionId: option.id, text: option.text, label: index + 1,
      skin: SKINS[(serial.current * 7 + index) % SKINS.length]!, golden: goldenWave && option.id === current.correctOptionId, item: null, r,
      ...launch(w * 0.08 + w * 0.84 * (index + 0.5) / count, 0.16 + Math.random() * 0.16),
      launchAt: now + (fresh ? LAUNCH_DELAY_MS : 120) + (order[index] ?? 0) * Math.max(80, 170 - count * 10), state: "waiting",
    }));
    if (fresh && talisman) next.push({ key: ++serial.current, wave: current, waveId: id, optionId: "", text: "", label: 0, skin: "pear",
      golden: false, item: talisman, r: Math.max(r * 0.85, 40), ...launch(w * (0.25 + Math.random() * 0.5), 0.1 + Math.random() * 0.12),
      launchAt: now + LAUNCH_DELAY_MS + count * 140 + 260, state: "waiting" });
    // Fruit already falling stay; a talisman still in the air can be caught after the wave changes.
    fruits.current = [...fruits.current.filter((fruit) => fruit.state === "dropped" || (fruit.item && fruit.state !== "sliced")), ...next];
    setWave(fruits.current);
  };

  useEffect(() => {
    if (active) toss(true);
    else {
      for (const fruit of fruits.current) if (fruit.state === "waiting") fruit.state = "dropped";
    }
    // A new wave starts only when the question changes or play (re)starts.
  }, [waveKey, active]);

  const burst = (x: number, y: number, colors: readonly string[], count: number, power: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = power * (0.35 + Math.random() * 0.75);
      const max = 0.45 + Math.random() * 0.45;
      particles.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - power * 0.35, life: max, max,
        size: 3 + Math.random() * 6, color: colors[i % colors.length]! });
    }
  };

  /** Juice soaks into the paper and fades, so a frantic run leaves the board splattered. */
  const stain = (x: number, y: number, r: number, color: string) => {
    const blobs = Array.from({ length: 7 }, (_, i): [number, number, number] => {
      const angle = Math.random() * Math.PI * 2;
      const reach = i === 0 ? 0 : r * (0.35 + Math.random() * 0.9);
      return [Math.cos(angle) * reach, Math.sin(angle) * reach, i === 0 ? r * 0.55 : r * (0.08 + Math.random() * 0.2)];
    });
    stains.current = [...stains.current.slice(-30), { x, y, color, born: performance.now(), blobs }];
  };

  const shake = (strength: number, duration: number) => {
    arena.current?.animate([
      { transform: `translate(${-strength}px, ${strength * 0.4}px)` }, { transform: `translate(${strength * 0.8}px, ${-strength * 0.5}px)` },
      { transform: `translate(${-strength * 0.5}px, ${strength * 0.2}px)` }, { transform: "none" },
    ], { duration, easing: "ease-out" });
  };

  const hit = (fruit: Fruit, angle: number) => {
    const { onSlice: slice, onItem: grant, playSound: sound } = latest.current;
    if (fruit.state !== "flying") return;
    const now = performance.now();
    const id = ++serial.current;
    slashes.current.push({ x: fruit.x, y: fruit.y, angle: angle * Math.PI / 180, length: fruit.r * 2.8, born: now });
    if (fruit.item) {
      fruit.state = "sliced";
      grant(fruit.item);
      setHalves((previous) => [...previous.slice(-9), { id, x: fruit.x, y: fruit.y, r: fruit.r, angle, fruit, correct: true }]);
      burst(fruit.x, fruit.y, JUICE[fruit.item], 40, 640);
      stain(fruit.x, fruit.y, fruit.r, fruit.item === "frenzy" ? "#c8361d" : "#2b2440");
      setPopups((previous) => [...previous.slice(-5), { id, x: fruit.x, y: fruit.y - fruit.r, title: NINJA_ITEMS[fruit.item!].label, score: null, tone: fruit.item!, chain: 0 }]);
      sound(fruit.item === "frenzy" ? "frenzy" : "curse");
      freezeUntil.current = now + 90;
      shake(fruit.item === "frenzy" ? 9 : 6, 260);
      setWave([...fruits.current]);
      return;
    }
    const remaining = fruits.current.filter((other) => other !== fruit && other.waveId === fruit.waveId && !other.item
      && (other.state === "flying" || other.state === "waiting")).length;
    const result = slice(fruit.wave, fruit.optionId, { elapsedMs: Math.max(now - waveStart.current, 0), golden: fruit.golden, remaining });
    if (!result) return;
    fruit.state = "sliced";
    setHalves((previous) => [...previous.slice(-9), { id, x: fruit.x, y: fruit.y, r: fruit.r, angle, fruit, correct: result.isCorrect }]);
    if (result.isCorrect) {
      const frenzyCut = result.details?.frenzy === true;
      if (!frenzyCut || remaining === 0) answered.current = true;
      if (!frenzyCut) for (const other of fruits.current) if (other !== fruit && !other.item && (other.state === "flying" || other.state === "waiting")) other.state = "dropped";
      chain.current = now - chain.current.at < CHAIN_MS ? { count: chain.current.count + 1, at: now } : { count: 1, at: now };
      const colors = fruit.golden ? JUICE.golden : JUICE[fruit.skin];
      burst(fruit.x, fruit.y, colors, fruit.golden ? 46 : 30, fruit.golden ? 620 : 480);
      stain(fruit.x, fruit.y, fruit.r, colors[0]!);
      const judgment = result.details?.judgment ?? "good";
      setPopups((previous) => [...previous.slice(-5), { id, x: fruit.x, y: fruit.y - fruit.r, title: JUDGMENT[judgment],
        score: result.scoreDelta, tone: fruit.golden ? "golden" : judgment, chain: chain.current.count }]);
      freezeUntil.current = now + (fruit.golden ? 95 : 55);
      shake(fruit.golden ? 8 : latest.current.fever ? 5 : 3, 150);
      sound("slice");
      if (fruit.golden) sound("golden");
      if (chain.current.count >= 2) sound("chain");
    } else {
      chain.current = { count: 0, at: 0 };
      burst(fruit.x, fruit.y, JUICE.miss, 18, 300);
      stain(fruit.x, fruit.y, fruit.r * 0.8, "#3a342b");
      sound("miss");
      shake(10, 320);
    }
    setWave([...fruits.current]);
  };

  // Physics, blade trail and juice all advance in one frame loop; fruit move by transform, not React state.
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const step = (now: number) => {
      const frozen = now < freezeUntil.current;
      const dt = frozen ? 0 : Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const { w, h } = size.current;
      let airborne = 0;
      let changed = false;
      for (const fruit of fruits.current) {
        if (fruit.state === "waiting" && now >= fruit.launchAt) {
          fruit.state = "flying";
          changed = true;
        }
        if (fruit.state === "flying" || fruit.state === "dropped") {
          fruit.vy += fruit.g * dt * (fruit.state === "dropped" ? 1.8 : 1);
          fruit.x += fruit.vx * dt;
          fruit.y += fruit.vy * dt;
        }
        if (fruit.state === "flying" && fruit.y - fruit.r > h && fruit.vy > 0) {
          fruit.state = "dropped";
          changed = true;
        }
        if (!fruit.item && (fruit.state === "flying" || fruit.state === "waiting")) airborne++;
        const element = elements.current.get(fruit.key);
        if (element) {
          const tilt = Math.sin(now / 420 + fruit.phase) * (fruit.item ? 16 : 9);
          element.style.transform = `translate(${fruit.x - fruit.r}px, ${fruit.y - fruit.r}px) rotate(${tilt}deg)`;
        }
      }
      const live = fruits.current.filter((fruit) => fruit.state !== "dropped" || fruit.y - fruit.r < h + 40);
      if (live.length !== fruits.current.length) {
        fruits.current = live;
        changed = true;
      }
      // Nobody sliced the right fruit before the wave fell: throw the same question again.
      if (latest.current.active && airborne === 0 && !answered.current) {
        latest.current.playSound("toss");
        toss(false);
      } else if (changed) setWave([...fruits.current]);

      const stainContext = stainCanvas.current?.getContext("2d");
      if (stainContext) {
        stainContext.clearRect(0, 0, w, h);
        stains.current = stains.current.filter((item) => now - item.born < STAIN_MS);
        for (const item of stains.current) {
          stainContext.globalAlpha = 0.5 * (1 - (now - item.born) / STAIN_MS);
          stainContext.fillStyle = item.color;
          for (const [dx, dy, radius] of item.blobs) {
            stainContext.beginPath();
            stainContext.arc(item.x + dx, item.y + dy, radius, 0, Math.PI * 2);
            stainContext.fill();
          }
        }
        stainContext.globalAlpha = 1;
      }

      const context = canvas.current?.getContext("2d");
      if (context) {
        context.clearRect(0, 0, w, h);
        particles.current = particles.current.filter((particle) => (particle.life -= dt || 0.004) > 0);
        for (const particle of particles.current) {
          particle.vy += 1_300 * dt;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
          context.globalAlpha = Math.min(particle.life / particle.max * 1.6, 1);
          context.fillStyle = particle.color;
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * (0.5 + particle.life / particle.max * 0.5), 0, Math.PI * 2);
          context.fill();
        }
        // A thin paper-white cut line flashes across every sliced fruit.
        slashes.current = slashes.current.filter((slash) => now - slash.born < 160);
        for (const slash of slashes.current) {
          const fade = 1 - (now - slash.born) / 160;
          const dx = Math.cos(slash.angle) * slash.length / 2, dy = Math.sin(slash.angle) * slash.length / 2;
          context.globalAlpha = fade;
          context.strokeStyle = "#fffaf0";
          context.lineCap = "round";
          context.lineWidth = 2 + fade * 5;
          context.beginPath();
          context.moveTo(slash.x - dx, slash.y - dy);
          context.lineTo(slash.x + dx, slash.y + dy);
          context.stroke();
        }
        context.globalAlpha = 1;
        // The blade is a brush stroke: thick where the hand is, tapering behind it.
        trail.current = trail.current.filter((point) => now - point.t < TRAIL_MS);
        const points = trail.current;
        if (points.length > 1) {
          const hot = latest.current.fever || latest.current.frenzy;
          context.lineCap = "round";
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1]!, b = points[i]!;
            const fresh = 1 - (now - b.t) / TRAIL_MS;
            const speed = Math.min(Math.hypot(b.x - a.x, b.y - a.y) / 24, 1);
            context.strokeStyle = hot ? `rgba(200, 54, 29, ${fresh})` : `rgba(27, 23, 18, ${fresh * 0.9})`;
            context.lineWidth = 1.5 + fresh * (6 + speed * 8);
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // The loop reads everything through refs, so it starts once.
    return () => cancelAnimationFrame(frame);
  }, []);

  const pointAt = (event: PointerEvent): TrailPoint => {
    const rect = arena.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top, t: performance.now() };
  };

  const sweep = (a: TrailPoint, b: TrailPoint) => {
    const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    for (const fruit of [...fruits.current]) {
      if (fruit.state === "flying" && segmentDistance(fruit.x, fruit.y, a, b) < fruit.r * 0.92) hit(fruit, angle);
    }
  };

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable='true']"))) return;
      const label = /^Digit([1-9])$/.exec(event.code)?.[1];
      if (!label) return;
      const fruit = fruits.current.find((candidate) => candidate.label === Number(label) && !candidate.item && candidate.state === "flying" && candidate.y < size.current.h);
      event.preventDefault();
      if (!fruit) return;
      const now = performance.now();
      // Draw a quick slash through the fruit so the keyboard feels like a blade too.
      trail.current.push({ x: fruit.x - fruit.r * 1.3, y: fruit.y + fruit.r * 0.6, t: now - 40 }, { x: fruit.x + fruit.r * 1.3, y: fruit.y - fruit.r * 0.6, t: now });
      latest.current.playSound("swoosh");
      hit(fruit, -25);
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  return <div ref={arena} className={styles.dojo} data-active={active} data-frenzy={frenzy}
    onPointerDown={(event) => {
      if (event.button !== 0 && event.pointerType === "mouse") return;
      event.currentTarget.setPointerCapture(event.pointerId);
      swiping.current = true;
      const point = pointAt(event);
      trail.current = [point];
      latest.current.playSound("swoosh");
      // A tap on a fruit slices it too, for touchpads and short swipes.
      sweep(point, point);
    }}
    onPointerMove={(event) => {
      if (!swiping.current) return;
      const point = pointAt(event);
      const last = trail.current[trail.current.length - 1];
      trail.current.push(point);
      if (last) sweep(last, point);
    }}
    onPointerUp={() => { swiping.current = false; }}
    onPointerCancel={() => { swiping.current = false; }}>
    <canvas ref={stainCanvas} className={styles.stains} aria-hidden="true" />
    <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
    {wave.filter((fruit) => fruit.state !== "sliced").map((fruit) => <div key={fruit.key}
      ref={(element) => { if (element) elements.current.set(fruit.key, element); else elements.current.delete(fruit.key); }}
      className={fruit.item ? styles.talisman : styles.fruit} data-skin={fruit.skin} data-golden={fruit.golden} data-item={fruit.item ?? undefined}
      data-dropped={fruit.state === "dropped"}
      style={{ width: fruit.r * 2, height: fruit.r * 2, transform: `translate(${fruit.x - fruit.r}px, ${fruit.y - fruit.r}px)` }}
      role="button" aria-label={fruit.item ? NINJA_ITEMS[fruit.item].label : `${fruit.label}번 ${fruit.text}`}>
      <FruitBody fruit={fruit} label={fruit.item ? undefined : fruit.label} />
    </div>)}
    {halves.map((half) => <div key={half.id} className={styles.cut} data-correct={half.correct}
      style={{ left: half.x - half.r, top: half.y - half.r, width: half.r * 2, height: half.r * 2 }}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) setHalves((previous) => previous.filter((entry) => entry.id !== half.id)); }}>
      <div className={styles.cutSpin} style={{ transform: `rotate(${half.angle}deg)` }}>
        {(["upper", "lower"] as const).map((side) => <div key={side} className={half.fruit.item ? styles.talisman : styles.fruit} data-half={side}
          data-skin={half.fruit.skin} data-golden={half.fruit.golden} data-item={half.fruit.item ?? undefined}>
          <div className={styles.halfFace} style={{ transform: `rotate(${-half.angle}deg)` }}><FruitBody fruit={half.fruit} /></div>
        </div>)}
      </div>
    </div>)}
    {popups.map((popup) => <div key={popup.id} className={styles.popup} data-tone={popup.tone}
      style={{ left: popup.x, top: popup.y }}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) setPopups((previous) => previous.filter((entry) => entry.id !== popup.id)); }}>
      {popup.chain >= 2 && <em>{popup.chain}연속 베기</em>}
      <strong>{popup.title}</strong>{popup.score !== null && <b>+{popup.score}</b>}
    </div>)}
  </div>;
}
