import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import type { AnswerResult } from "../../game-engine/core/types.ts";
import type { NinjaDetails, NinjaQuestion } from "./model.ts";
import type { NinjaSound } from "./useNinjaSound.ts";
import styles from "./WordNinja.module.css";

const SKINS = ["watermelon", "orange", "apple", "grape", "lime"] as const;
type Skin = (typeof SKINS)[number];
const JUICE: Record<Skin | "golden" | "miss", readonly string[]> = {
  watermelon: ["#ff4d6d", "#ff8fa3", "#2fbf71"],
  orange: ["#ff9f1c", "#ffbf69", "#fff3b0"],
  apple: ["#ff4d5e", "#fff6df", "#ffd6a5"],
  grape: ["#a259ff", "#d0a2ff", "#7b2cbf"],
  lime: ["#9ef01a", "#d9ed92", "#38b000"],
  golden: ["#ffd23f", "#fff6df", "#ffb703", "#ffffff"],
  miss: ["#7d8597", "#adb5bd", "#3a3f58"],
};

const TRAIL_MS = 170;
const LAUNCH_DELAY_MS = 420;

interface Fruit {
  readonly key: number;
  readonly optionId: string;
  readonly text: string;
  readonly label: number;
  readonly skin: Skin;
  readonly golden: boolean;
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

interface Half {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly angle: number;
  readonly fruit: Pick<Fruit, "text" | "skin" | "golden">;
  readonly correct: boolean;
}

interface Popup { readonly id: number; readonly x: number; readonly y: number; readonly score: number; readonly judgment: string; readonly golden: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
interface TrailPoint { readonly x: number; readonly y: number; readonly t: number }

const labelSize = (text: string) => text.length <= 5 ? 1 : text.length <= 9 ? 0.82 : text.length <= 15 ? 0.68 : 0.56;

function FruitBody({ fruit, label }: { readonly fruit: Pick<Fruit, "text" | "skin" | "golden">; readonly label?: number }) {
  return <>
    <i className={styles.leaf} aria-hidden="true" />
    <i className={styles.shine} aria-hidden="true" />
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

export default function Dojo({ question, waveKey, golden, active, fever, onSlice, playSound }: {
  readonly question: NinjaQuestion;
  /** Changes whenever a new question should be tossed. */
  readonly waveKey: number;
  readonly golden: boolean;
  readonly active: boolean;
  readonly fever: boolean;
  readonly onSlice: (optionId: string, elapsedMs: number) => AnswerResult<NinjaDetails> | null;
  readonly playSound: (sound: NinjaSound) => void;
}) {
  const arena = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 800, h: 500 });
  const fruits = useRef<Fruit[]>([]);
  const elements = useRef(new Map<number, HTMLDivElement>());
  const particles = useRef<Particle[]>([]);
  const trail = useRef<TrailPoint[]>([]);
  const swiping = useRef(false);
  const waveStart = useRef(0);
  /** The current question was answered, so a fallen wave must not be thrown again. */
  const answered = useRef(false);
  const serial = useRef(0);
  const [wave, setWave] = useState<readonly Fruit[]>([]);
  const [halves, setHalves] = useState<Half[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const latest = useRef({ question, golden, active, fever, onSlice, playSound });
  latest.current = { question, golden, active, fever, onSlice, playSound };

  useLayoutEffect(() => {
    const element = arena.current;
    if (!element) return undefined;
    const resize = () => {
      const rect = element.getBoundingClientRect();
      size.current = { w: Math.max(rect.width, 1), h: Math.max(rect.height, 1) };
      const target = canvas.current;
      if (target) {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
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
    const { question: current, golden: goldenWave } = latest.current;
    const { w, h } = size.current;
    const count = current.options.length;
    const r = Math.min(Math.max(Math.min(w / (count * 2.6), h * 0.16), 50), 92);
    const now = performance.now();
    if (fresh) {
      waveStart.current = now + LAUNCH_DELAY_MS;
      answered.current = false;
    }
    const order = current.options.map((_, index) => index).sort(() => Math.random() - 0.5);
    const next = current.options.map((option, index): Fruit => {
      const x = w * 0.1 + w * 0.8 * (index + 0.5) / count;
      const apex = h * (0.16 + Math.random() * 0.16);
      const startY = h + r;
      const rise = 1.3 + Math.random() * 0.25;
      const g = 2 * (startY - apex) / (rise * rise);
      return { key: ++serial.current, optionId: option.id, text: option.text, label: index + 1,
        skin: SKINS[(serial.current * 7 + index) % SKINS.length]!, golden: goldenWave && option.id === current.correctOptionId, r,
        x, y: startY, vx: (w / 2 - x) * 0.05 + (Math.random() - 0.5) * 40, vy: -g * rise, g, phase: Math.random() * 6,
        launchAt: now + (fresh ? LAUNCH_DELAY_MS : 120) + (order[index] ?? 0) * 170, state: "waiting" };
    });
    fruits.current = [...fruits.current.filter((fruit) => fruit.state === "dropped"), ...next];
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

  const hit = (fruit: Fruit, angle: number) => {
    const { onSlice: slice, playSound: sound } = latest.current;
    if (fruit.state !== "flying") return;
    const result = slice(fruit.optionId, Math.max(performance.now() - waveStart.current, 0));
    if (!result) return;
    fruit.state = "sliced";
    const id = ++serial.current;
    setHalves((previous) => [...previous.slice(-7), { id, x: fruit.x, y: fruit.y, r: fruit.r, angle, fruit, correct: result.isCorrect }]);
    if (result.isCorrect) {
      answered.current = true;
      for (const other of fruits.current) if (other !== fruit && (other.state === "flying" || other.state === "waiting")) other.state = "dropped";
      burst(fruit.x, fruit.y, fruit.golden ? JUICE.golden : JUICE[fruit.skin], fruit.golden ? 46 : 30, fruit.golden ? 620 : 480);
      setPopups((previous) => [...previous.slice(-4), { id, x: fruit.x, y: fruit.y - fruit.r, score: result.scoreDelta,
        judgment: (result.details?.judgment ?? "good").toUpperCase(), golden: fruit.golden }]);
      sound("slice");
      if (fruit.golden) sound("golden");
    } else {
      burst(fruit.x, fruit.y, JUICE.miss, 18, 300);
      sound("miss");
      arena.current?.animate([{ transform: "translate(-10px, 4px)" }, { transform: "translate(9px, -5px)" }, { transform: "translate(-6px, 2px)" }, { transform: "none" }],
        { duration: 320, easing: "ease-out" });
    }
    setWave([...fruits.current]);
  };

  // Physics, blade trail and juice all advance in one frame loop; fruit move by transform, not React state.
  useEffect(() => {
    let frame = 0;
    let previous = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
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
        if (fruit.state === "flying" || fruit.state === "waiting") airborne++;
        const element = elements.current.get(fruit.key);
        if (element) {
          const tilt = Math.sin(now / 420 + fruit.phase) * 9;
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

      const context = canvas.current?.getContext("2d");
      if (context) {
        context.clearRect(0, 0, w, h);
        particles.current = particles.current.filter((particle) => (particle.life -= dt) > 0);
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
        context.globalAlpha = 1;
        trail.current = trail.current.filter((point) => now - point.t < TRAIL_MS);
        const points = trail.current;
        if (points.length > 1) {
          context.lineCap = "round";
          context.shadowColor = latest.current.fever ? "#ffd23f" : "#4cd7ff";
          context.shadowBlur = 18;
          for (let i = 1; i < points.length; i++) {
            const a = points[i - 1]!, b = points[i]!;
            const fresh = 1 - (now - b.t) / TRAIL_MS;
            context.strokeStyle = latest.current.fever ? `rgba(255, 228, 120, ${fresh})` : `rgba(235, 250, 255, ${fresh})`;
            context.lineWidth = 2 + fresh * 9;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
          context.shadowBlur = 0;
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
      const label = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code) + 1;
      if (!label) return;
      const fruit = fruits.current.find((candidate) => candidate.label === label && candidate.state === "flying" && candidate.y < size.current.h);
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

  return <div ref={arena} className={styles.dojo} data-active={active}
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
    <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
    {wave.filter((fruit) => fruit.state !== "sliced").map((fruit) => <div key={fruit.key}
      ref={(element) => { if (element) elements.current.set(fruit.key, element); else elements.current.delete(fruit.key); }}
      className={styles.fruit} data-skin={fruit.skin} data-golden={fruit.golden} data-dropped={fruit.state === "dropped"}
      style={{ width: fruit.r * 2, height: fruit.r * 2, transform: `translate(${fruit.x - fruit.r}px, ${fruit.y - fruit.r}px)` }}
      role="button" aria-label={`${fruit.label}번 ${fruit.text}`}>
      <FruitBody fruit={fruit} label={fruit.label} />
    </div>)}
    {halves.map((half) => <div key={half.id} className={styles.cut} data-correct={half.correct}
      style={{ left: half.x - half.r, top: half.y - half.r, width: half.r * 2, height: half.r * 2 }}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) setHalves((previous) => previous.filter((item) => item.id !== half.id)); }}>
      <div className={styles.cutSpin} style={{ transform: `rotate(${half.angle}deg)` }}>
        {(["upper", "lower"] as const).map((side) => <div key={side} className={styles.fruit} data-half={side} data-skin={half.fruit.skin} data-golden={half.fruit.golden}>
          <div className={styles.halfFace} style={{ transform: `rotate(${-half.angle}deg)` }}><FruitBody fruit={half.fruit} /></div>
        </div>)}
      </div>
    </div>)}
    {popups.map((popup) => <div key={popup.id} className={styles.popup} data-golden={popup.golden} data-judgment={popup.judgment.toLowerCase()}
      style={{ left: popup.x, top: popup.y }}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) setPopups((previous) => previous.filter((item) => item.id !== popup.id)); }}>
      <strong>{popup.judgment}</strong><b>+{popup.score}</b>
    </div>)}
  </div>;
}
