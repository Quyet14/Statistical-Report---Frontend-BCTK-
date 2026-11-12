"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

type Mode = "animated" | "still" | "off";
const key = "careops-visual-background";
const eventName = "careops-background-change";
let fallback: Mode = "animated";

function snapshot(): Mode {
  try {
    const stored = localStorage.getItem(key);
    if (stored === "animated" || stored === "still" || stored === "off")
      return stored;
  } catch {
    /* A restricted browser still gets a working setting for this tab. */
  }
  return fallback;
}
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(eventName, callback);
    window.removeEventListener("storage", callback);
  };
}

export function GalaxyBackdrop() {
  const mode = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "animated" as Mode,
  );

  const labels: Record<Mode, string> = {
    animated: "Nền 3D · Chuyển động",
    still: "Nền 3D · Tĩnh",
    off: "Nền sáng",
  };
  const next: Record<Mode, Mode> = {
    animated: "still",
    still: "off",
    off: "animated",
  };
  return (
    <>
      <div className={`galaxy-backdrop galaxy-${mode}`} aria-hidden="true">
        <GalaxyCanvas mode={mode} />
      </div>
      <button
        type="button"
        className="galaxy-control"
        aria-label={`${labels[mode]}. Chuyển sang ${labels[next[mode]]}`}
        onClick={() => {
          fallback = next[mode];
          try {
            localStorage.setItem(key, fallback);
          } catch {
            /* tab preference remains available */
          }
          window.dispatchEvent(new Event(eventName));
        }}
      >
        <span aria-hidden="true">✧</span> {labels[mode]}
      </button>
    </>
  );
}

/* ---------- deterministic helpers (no flashes on resize / navigation) ---------- */
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const TAU = Math.PI * 2;

/* Disc tilt: long axis runs lower-left -> upper-right, like the reference */
const TILT_ANGLE = -0.84;
const TILT = 0.4;

/* Ring bands: [start, end, density, brightness]. Gaps between them stay dark. */
const BANDS: [number, number, number, number, number][] = [
  [0.22, 0.68, 0.2, 0.9, 1], // smooth glowing inner disc: only a few fine specks
  [0.72, 0.9, 1.9, 0.9, 3], // wide dark ring: many tiny bright specks
  [0.925, 0.945, 0.2, 1.0, 2], // the glowing line
  [1.0, 1.13, 1.2, 0.6, 4], // chunky outer belt
];
const BAND_TOTAL = BANDS.reduce((s, b) => s + b[2], 0);

/* Concentric lanes in the dark ring: 1 = a lane crowded with white specks, 0 = a black lane */
const laneAt = (r: number) => 0.5 + 0.5 * Math.sin(r * 150 + 1.8 * Math.sin(r * 31) + 0.4);

/* Each radial zone of the rings spins at its own rate (inner faster, like real orbits) */
const ZONE_SPIN = [1.6, 0.8, 0.5];

/* 0 blue · 1 cyan · 2 orange · 3 white · 4 dark speck · 5 yellow */
const COLORS = ["#2f8cff", "#9fe9ff", "#ffb347", "#f4fbff", "#01040c", "#ffe066"];

type Particle = {
  r: number;
  phase: number;
  z: number;
  size: number;
  speed: number;
  tw: number;
  kind: number;
  dust: boolean;
};

function makeParticles(ringCount: number, dustCount: number): Particle[] {
  const list: Particle[] = [];
  for (let i = 0; i < ringCount; i++) {
    let pick = rnd(i * 3.1) * BAND_TOTAL;
    let band = BANDS[0];
    for (const b of BANDS) {
      if (pick < b[2]) {
        band = b;
        break;
      }
      pick -= b[2];
    }
    let r = band[0] + rnd(i * 5.3 + 1) * (band[1] - band[0]);
    if (band[4] === 3) {
      for (let t = 1; t < 6 && laneAt(r) < 0.45; t++) r = band[0] + rnd(i * 5.3 + 1 + t * 17.3) * (band[1] - band[0]);
    }
    const c = rnd(i * 11.7 + 4);
    let kind = 0;
    if (c < 0.03) kind = 2;
    else if (c < 0.05) kind = 5;
    else if (band[4] === 3) kind = c < 0.55 ? 3 : c < 0.8 ? 1 : 0;
    else if (band[4] === 4) kind = c < 0.62 ? 0 : c < 0.78 ? 1 : c < 0.9 ? 3 : 4;
    else kind = c < 0.5 ? 1 : c < 0.8 ? 3 : 0;
    list.push({
      r,
      phase: rnd(i * 7.7 + 2) * TAU,
      z: (rnd(i * 2.9 + 9) - 0.5) * 0.016,
      size: (kind === 4 ? 0.8 + rnd(i * 6.1) * 1.3 : 0.4 + Math.pow(rnd(i * 13.1 + 6), 2) * 1.4) * (band[4] === 3 ? 0.55 : r < 0.85 ? 0.6 : 1),
      speed: 1 / Math.pow(r, 1.5),
      tw: rnd(i * 17.3 + 8) * TAU,
      kind,
      dust: false,
    });
  }
  for (let i = 0; i < dustCount; i++) {
    const k = i + 9000;
    const r = 0.3 + Math.pow(rnd(k * 3.3), 1.4) * 0.85;
    const c = rnd(k * 6.1);
    list.push({
      r,
      phase: rnd(k * 1.7) * TAU,
      z: (rnd(k * 9.1) - 0.5) * 0.14 * r,
      size: 0.3 + rnd(k * 4.7) * 0.9,
      speed: 0.8 / Math.pow(r, 1.5),
      tw: rnd(k * 8.9) * TAU,
      kind: c < 0.08 ? 2 : c < 0.55 ? 3 : c < 0.8 ? 1 : 0,
      dust: true,
    });
  }
  // grainy outer belt: dense blue speckles with a ragged, fading edge
  for (let i = 0; i < 9000; i++) {
    const k = i + 20000;
    const r = 1.0 + Math.pow(rnd(k * 2.3), 1.7) * 0.15;
    const c = rnd(k * 6.7);
    list.push({
      r,
      phase: rnd(k * 1.3) * TAU,
      z: (rnd(k * 9.7) - 0.5) * 0.05,
      size: 0.8 + rnd(k * 4.1) * 1.2,
      speed: 1 / Math.pow(r, 1.5),
      tw: rnd(k * 8.3) * TAU,
      kind: c < 0.7 ? 0 : c < 0.84 ? 1 : c < 0.96 ? 3 : 2,
      dust: false,
    });
  }
  list.sort((a, b) => a.kind - b.kind); // grouped by colour: far fewer fillStyle changes per frame
  return list;
}

/* Dust plumes streaming away from the disc along its minor axis */
type Plume = { u: number; dir: number; p0: number; size: number; kind: number; tw: number; speed: number };
function makePlumes(count: number): Plume[] {
  const list = Array.from({ length: count }, (_, i) => {
    const c = rnd(i * 6.6 + 3);
    return {
      u: (rnd(i * 5.1) + rnd(i * 7.3 + 2) + rnd(i * 9.7 + 4) - 1.5) * 0.2,
      dir: rnd(i * 3.3 + 1) < 0.55 ? -1 : 1,
      p0: rnd(i * 2.7 + 6),
      size: 0.6 + Math.pow(rnd(i * 4.4 + 8), 2) * 2.0,
      kind: c < 0.48 ? 3 : c < 0.6 ? 1 : c < 0.76 ? 0 : c < 0.88 ? 2 : 5,
      tw: rnd(i * 8.1 + 5) * TAU,
      speed: 0.6 + rnd(i * 1.9 + 7) * 0.8,
    };
  });
  list.sort((a, b) => a.kind - b.kind);
  return list;
}

/* ---------- golden orbits around the planet: tilted ellipses of glittering gold dust ---------- */
type GoldOrbit = { a: number; e: number; phi: number; theta: number; spin: number; prec: number; dir: number };
const GOLD_ORBITS: GoldOrbit[] = [
  { a: 2.1, e: 0.55, phi: -0.35, theta: 1.05, spin: 0.00052, prec: 0.00004, dir: 1 },
  { a: 2.6, e: 0.4, phi: 1.1, theta: 1.2, spin: 0.00042, prec: -0.00003, dir: -1 },
  { a: 3.2, e: 0.62, phi: 2.2, theta: 0.8, spin: 0.00035, prec: 0.00002, dir: 1 },
  { a: 3.8, e: 0.32, phi: -1.2, theta: 1.4, spin: 0.00058, prec: -0.00004, dir: -1 },
];
const GOLD_RGB = ["255,205,80", "255,226,140", "255,240,190", "255,170,40"];
const GOLD_FILL = GOLD_RGB.map((c) => `rgb(${c})`);
type GoldDot = { orbit: number; u: number; off: number; size: number; tw: number; kind: number; big: boolean };
function makeGold(perOrbit: number): GoldDot[] {
  const list: GoldDot[] = [];
  GOLD_ORBITS.forEach((_, o) => {
    for (let i = 0; i < perOrbit; i++) {
      const h = o * 5000 + i * 3.7;
      const c = rnd(h + 4);
      list.push({
        orbit: o,
        u: (i + (rnd(h + 1) - 0.5) * 0.8) / perOrbit,
        off: (rnd(h + 2) + rnd(h + 3) - 1) * 0.1,
        size: 0.7 + Math.pow(rnd(h + 5), 2.0) * 1.8,
        tw: rnd(h + 6) * TAU,
        kind: c < 0.45 ? 0 : c < 0.75 ? 1 : c < 0.9 ? 2 : 3,
        big: i % 11 === 0 || rnd(h + 8) < 0.02,
      });
    }
  });
  return list;
}

type Star = { x: number; y: number; size: number; tw: number; live: boolean };
function makeStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    x: rnd(i * 4.1 + 20),
    y: rnd(i * 8.3 + 50),
    size: i % 11 === 0 ? 1.4 : i % 3 === 0 ? 0.9 : 0.55,
    tw: rnd(i * 2.2) * TAU,
    live: i % 4 === 0,
  }));
}

/* ---------- planet surface: seamless turbulent bands, rendered onto a lit sphere ---------- */
const TEX_W = 768;
const TEX_H = 384;
const GLOW = 0xffffffff;
const hash2 = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function vnoise(x: number, y: number, period: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const wrap = (a: number) => ((a % period) + period) % period;
  const a = hash2(wrap(xi), yi);
  const b = hash2(wrap(xi + 1), yi);
  const c = hash2(wrap(xi), yi + 1);
  const d = hash2(wrap(xi + 1), yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
function fbm(x: number, y: number, period: number) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < 4; o++) {
    v += amp * vnoise(x * f, y * f, period * f);
    f *= 2;
    amp *= 0.5;
  }
  return v;
}
const EARTH_SEA = 0.53;
/* "blue": smooth glossy blue planet (as in the reference picture). "earth": continents and clouds. */
const PLANET_STYLE = "earth" as "blue" | "earth";
type EarthTex = {
  height: Uint8Array;
  relief: Uint8Array;
  moist: Uint8Array;
  cloud: Uint8Array;
  lights: Uint8Array;
};
let earthTex: EarthTex | null = null;
function earthTextures(): EarthTex {
  if (earthTex) return earthTex;
  const n = TEX_W * TEX_H;
  const height = new Uint8Array(n);
  const relief = new Uint8Array(n);
  const moist = new Uint8Array(n);
  const cloud = new Uint8Array(n);
  const lights = new Uint8Array(n);
  const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
  for (let y = 0; y < TEX_H; y++) {
    const v = y / TEX_H;
    for (let x = 0; x < TEX_W; x++) {
      const u = x / TEX_W;
      const idx = y * TEX_W + x;
      // continents: domain-warped fractal noise, with fine fractal coastlines
      const w1 = fbm(u * 3, v * 1.5 + 4.1, 3);
      const w2 = fbm(u * 6 + 5.2, v * 3 + 1.7, 6);
      const hh =
        fbm(u * 4 + w1 * 1.4, v * 2 + w1 * 1.0, 4) * 0.55 +
        fbm(u * 9 + w2 * 0.8, v * 4.5 + w2 * 0.6, 9) * 0.3 +
        fbm(u * 24, v * 12, 24) * 0.15;
      const hv = clamp01((hh - 0.22) * 1.5);
      height[idx] = Math.round(hv * 255);
      // mountain ridges and climate
      const ridge = 1 - Math.abs(2 * fbm(u * 12 + 9.1, v * 6 + 3.3, 12) - 1);
      relief[idx] = Math.round(clamp01(ridge) * 255);
      const mo = clamp01((fbm(u * 5 + 1.9, v * 2.5 + 7.7, 5) - 0.3) * 2.2);
      moist[idx] = Math.round(mo * 255);
      // clouds: streaky weather systems stretched east-west
      const cw = fbm(u * 3 + 2.2, v * 2 + 0.7, 3);
      const cw2 = fbm(u * 6 + 7.1, v * 4 + 3.3, 6);
      const c1 = fbm(u * 6 + cw * 2.2, v * 5 + cw * 1.6, 6);
      const c2 = fbm(u * 14 + cw2 * 1.3, v * 10 + cw2 * 1.0, 14);
      const c3 = fbm(u * 32 + cw2, v * 20, 32);
      const dens = c1 * 0.5 + c2 * 0.32 + c3 * 0.18;
      cloud[idx] = Math.round(Math.pow(clamp01((dens - 0.46) * 4.2), 1.15) * 255);
      const city =
        hv > EARTH_SEA + 0.02 && mo > 0.4 && hash2(x * 7 + 3, y * 11 + 5) > 0.985 && fbm(u * 12, v * 6, 12) > 0.5;
      lights[idx] = city ? 255 : 0;
    }
  }
  earthTex = { height, relief, moist, cloud, lights };
  return earthTex;
}
function sampleU(tex: Uint8Array, row: number, u: number) {
  const fx = u * TEX_W;
  const f0 = Math.floor(fx);
  const x0 = f0 % TEX_W;
  const x1 = (x0 + 1) % TEX_W;
  const fr = fx - f0;
  return tex[row + x0] * (1 - fr) + tex[row + x1] * fr;
}

/* Comets: a glowing head with a long tapered tail, crossing the sky */
type Comet = { x: number; y: number; vx: number; vy: number; len: number; size: number; front: boolean; rgb: string };

/* Dust and tiny stars far outside the rings, spiralling in toward the disc and fading out */
type Infall = {
  p0: number;
  rIn: number;
  rOut: number;
  phase: number;
  spin: number;
  size: number;
  tw: number;
  kind: number;
  speed: number;
  trail: boolean;
  big: boolean;
  z: number;
};
function makeInfall(count: number): Infall[] {
  return Array.from({ length: count }, (_, i) => {
    const c = rnd(i * 6.1 + 11);
    return {
      p0: rnd(i * 2.3 + 5),
      rIn: 1.1 + rnd(i * 3.7) * 0.06,
      rOut: 1.35 + Math.pow(rnd(i * 4.9 + 2), 1.3) * 1.1,
      phase: rnd(i * 7.1 + 3) * TAU,
      spin: 3.5 + rnd(i * 8.3 + 1) * 3.5,
      size: 0.5 + Math.pow(rnd(i * 5.7 + 9), 2.2) * 1.8,
      tw: rnd(i * 9.1) * TAU,
      kind: c < 0.5 ? 3 : c < 0.72 ? 1 : c < 0.9 ? 0 : c < 0.96 ? 2 : 5,
      speed: 0.6 + rnd(i * 1.3 + 4) * 0.9,
      trail: rnd(i * 2.9 + 8) < 0.3,
      big: i % 47 === 0,
      z: (rnd(i * 3.3 + 6) - 0.5) * 0.08,
    };
  });
}

/* Small far-away worlds drifting across the background */
type World = {
  x0: number;
  y0: number;
  r: number;
  vx: number;
  vy: number;
  kind: "gas" | "ice" | "rock" | "ringed";
  c: [string, string, string];
  glow: string;
};
const WORLDS: World[] = [
  { x0: 0.16, y0: 0.2, r: 16, vx: 3.4, vy: 0.9, kind: "gas", c: ["#f6dcae", "#c98a4b", "#5e3418"], glow: "255,190,120" },
  { x0: 0.06, y0: 0.74, r: 9, vx: 2.3, vy: -0.5, kind: "ice", c: ["#f4fcff", "#9ad1ff", "#32608f"], glow: "150,210,255" },
  { x0: 0.64, y0: 0.1, r: 7, vx: -2.7, vy: 1.1, kind: "rock", c: ["#ffbf9c", "#c2573a", "#44190f"], glow: "255,140,100" },
  { x0: 0.4, y0: 0.88, r: 12, vx: 2.9, vy: -1.2, kind: "ringed", c: ["#c8f4de", "#4fae93", "#123f38"], glow: "120,230,190" },
];

function GalaxyCanvas({ mode, hero = false }: { mode: Mode; hero?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode === "off") return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    const g: CanvasRenderingContext2D = context;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 1,
      height = 1,
      frame = 0,
      last = 0,
      angle = 0,
      time = 0;
    let pointerX = 0,
      pointerY = 0,
      driftX = 0,
      driftY = 0;
    let nextComet = 2500;
    let comets: Comet[] = [];

    const particles = makeParticles(hero ? 8500 : 10500, hero ? 1400 : 1900);
    const plumes = makePlumes(hero ? 2600 : 4200);
    const infall = makeInfall(hero ? 650 : 950);
    const im = infall.length;
    const ix = new Float32Array(im);
    const iy = new Float32Array(im);
    const itx = new Float32Array(im);
    const ity = new Float32Array(im);
    const isz = new Float32Array(im);
    const ial = new Float32Array(im);
    const ids = new Float32Array(im);
    const gold = makeGold(hero ? 420 : 700);
    const goldN = gold.length;
    const gX = new Float32Array(goldN);
    const gY = new Float32Array(goldN);
    const gZ = new Float32Array(goldN);
    const gA = new Float32Array(goldN);
    const goldSprite = document.createElement("canvas"); // soft golden glow used for the big bokeh dots
    goldSprite.width = 64;
    goldSprite.height = 64;
    {
      const sc = goldSprite.getContext("2d");
      if (sc) {
        const gr = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, "rgba(255,246,205,1)");
        gr.addColorStop(0.25, "rgba(255,210,100,0.8)");
        gr.addColorStop(0.55, "rgba(255,172,40,0.35)");
        gr.addColorStop(1, "rgba(255,150,30,0)");
        sc.fillStyle = gr;
        sc.fillRect(0, 0, 64, 64);
      }
    }
    /* quality governor: 1 = everything; lower values draw a random subset of the specks (see rank arrays) */
    const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || window.matchMedia("(pointer: coarse)").matches;
    let quality = lowEnd ? 0.7 : 1;
    let frameCost = 8; // smoothed milliseconds spent in draw()
    let adaptTick = 0;
    let fps60 = false;
    const makeGlow = (rgb: string) => {
      const cv = document.createElement("canvas");
      cv.width = 48;
      cv.height = 48;
      const gc = cv.getContext("2d");
      if (gc) {
        const gr = gc.createRadialGradient(24, 24, 0, 24, 24, 24);
        gr.addColorStop(0, `rgba(${rgb},0.95)`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
        gc.fillStyle = gr;
        gc.fillRect(0, 0, 48, 48);
      }
      return cv;
    };
    const glowWhite = makeGlow("225,245,255");
    const glowGold = makeGlow("255,214,130");
    const glowBlue = makeGlow("140,200,255");
    const grank = gold.map((d) => d.tw / TAU);
    const prankPlume = plumes.map((p) => p.tw / TAU);
    const glint = particles.map((p, i) => !p.dust && (p.kind === 1 || p.kind === 3) && i % 61 === 0);
    const stars = makeStars(170);
    const n = particles.length;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const ss = new Float32Array(n);
    const al = new Float32Array(n);
    const ds = new Float32Array(n);
    const prank = new Float32Array(n);
    for (let i = 0; i < n; i++) prank[i] = rnd(i * 1.7 + 0.3);
    const pkind = new Uint8Array(n);
    for (let i = 0; i < n; i++) pkind[i] = particles[i].kind;
    const bg = document.createElement("canvas"); // baked faint glow + static stars

    function layout() {
      const radius = hero
        ? Math.min(width * 0.34, height * 0.36)
        : Math.min(width * 0.29, height * 0.35, 400);
      const cx = hero ? width * 0.5 : Math.min(width * 0.8, width - radius * 1.12 - 16);
      const cy = hero
        ? height * 0.5
        : Math.max(radius * 1.28, Math.min(height * 0.42, height - radius * 1.28));
      return { radius, cx, cy };
    }

    function bakeBackground(dpr: number) {
      bg.width = Math.round(width * dpr);
      bg.height = Math.round(height * dpr);
      const b = bg.getContext("2d");
      if (!b) return;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.clearRect(0, 0, width, height);
      const { cx: px, cy: py } = layout();
      const big = Math.max(width, height);
      const gr = b.createRadialGradient(px, py, 0, px, py, big * 0.5);
      gr.addColorStop(0, "rgba(20,80,220,0.16)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      b.globalCompositeOperation = "lighter";
      b.fillStyle = gr;
      b.fillRect(0, 0, width, height);
      b.globalCompositeOperation = "source-over";
      for (const s of stars) {
        if (s.live) continue;
        b.fillStyle = "rgba(176,210,255,0.5)";
        b.beginPath();
        b.arc(s.x * width, s.y * height, s.size, 0, TAU);
        b.fill();
      }
    }

    const coreOf = (radius: number) => Math.max(15, radius * (hero ? 0.18 : 0.17));
    let pCanvas: HTMLCanvasElement | null = null;
    let pCtx: CanvasRenderingContext2D | null = null;
    let pImg: ImageData | null = null;
    let pS = 1;
    let pK = 1;
    let pIdx = new Uint32Array(0);
    let pLon = new Float32Array(0);
    let pRow = new Uint32Array(0);
    let pShade = new Float32Array(0);
    let pRim = new Float32Array(0);
    let pAlpha = new Float32Array(0);
    let pPole = new Float32Array(0);
    let pSpec = new Float32Array(0);
    let pRingBand = new Float32Array(0);
    let curDpr = 1;
    let planetTurns = -9; // rotation at the last render of the planet bitmap

    /* The two dust plumes hold thousands of tiny specks that drift very slowly, so their body is drawn into
       two bitmaps (even / odd specks), each rebuilt a few times a second; only the sparkles are drawn live. */
    const plumeCv: HTMLCanvasElement[] = [document.createElement("canvas"), document.createElement("canvas")];
    const plumeDirty = [true, true];
    let plumeNext = 0;
    let plumeLast = -1e9;
    let plumeR = 0;
    let plumeK = 1;
    const plumeOx = () => plumeR * 0.62;
    const plumeOy = () => plumeR * 1.8;

    function ensurePlumeCache(R: number, dpr: number) {
      const k = Math.min(dpr, 1.25);
      if (Math.abs(R - plumeR) < 0.5 && k === plumeK && plumeCv[0].width > 1) return;
      plumeR = R;
      plumeK = k;
      for (const cv of plumeCv) {
        cv.width = Math.ceil(R * 1.24 * k);
        cv.height = Math.ceil(R * 3.6 * k);
      }
      plumeDirty[0] = plumeDirty[1] = true;
    }

    function renderPlumeHalf(h: number, t: number, R: number, sk: number) {
      const cv = plumeCv[h];
      const c = cv.getContext("2d");
      if (!c) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cv.width, cv.height);
      c.setTransform(plumeK, 0, 0, plumeK, plumeOx() * plumeK, plumeOy() * plumeK);
      c.globalCompositeOperation = "lighter";
      let lastKind = -1;
      for (let pi = h; pi < plumes.length; pi += 2) {
        if (prankPlume[pi] > quality) continue;
        const p = plumes[pi];
        const f = (p.p0 + t * 0.000018 * p.speed) % 1;
        const fade = Math.sin(f * Math.PI);
        if (fade <= 0.02) continue;
        const x = p.u * (0.7 + f) * R + Math.sin(t * 0.0012 + p.tw) * R * 0.015;
        const y = p.dir * (0.45 + f * 1.25) * R;
        const tw2 = Math.sin(t * 0.004 + p.tw);
        c.globalAlpha = Math.min(1, fade * (0.35 + 0.7 * tw2 * tw2 + 0.1));
        if (p.kind !== lastKind) {
          c.fillStyle = COLORS[p.kind];
          lastKind = p.kind;
        }
        const sz = p.size * (1.25 - f * 0.4) * sk;
        if (sz < 1.5) c.fillRect(x - sz, y - sz, sz * 2, sz * 2);
        else {
          c.beginPath();
          c.arc(x, y, sz, 0, TAU);
          c.fill();
        }
      }
    }

    function bakePlanet(dpr: number) {
      const kk = Math.min(dpr, 1.5);
      const Rp = coreOf(layout().radius) * kk;
      const S = Math.ceil(Rp * 2 * 1.14);
      pK = kk;
      pS = S;
      const cv = pCanvas ?? document.createElement("canvas");
      pCanvas = cv;
      cv.width = S;
      cv.height = S;
      const pc = cv.getContext("2d");
      if (!pc) return;
      pCtx = pc;
      pImg = pc.createImageData(S, S);
      const total = S * S;
      pLon = new Float32Array(total);
      pRow = new Uint32Array(total);
      pShade = new Float32Array(total);
      pRim = new Float32Array(total);
      pAlpha = new Float32Array(total);
      pPole = new Float32Array(total);
      pSpec = new Float32Array(total);
      pRingBand = new Float32Array(total);
      const lx = -0.5;
      const ly = 0.5;
      const lz = 0.7;
      const ll = Math.hypot(lx, ly, lz);
      const Lx = lx / ll;
      const Ly = ly / ll;
      const Lz = lz / ll;
      const lxy = Math.hypot(Lx, Ly);
      const Hx = Lx;
      const Hy = Ly;
      const Hz = Lz + 1;
      const hl = Math.hypot(Hx, Hy, Hz);
      const idx: number[] = [];
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = x + 0.5 - S / 2;
          const dy = y + 0.5 - S / 2;
          const dist = Math.hypot(dx, dy);
          const i = y * S + x;
          if (dist <= Rp + 1.2) {
            const nx = dx / Rp;
            const ny = dy / Rp;
            const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
            const diffuse = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
            pAlpha[i] = Math.min(1, Math.max(0, (Rp - dist) / 1.4 + 0.5));
            pShade[i] = (0.05 + 1.05 * Math.pow(diffuse, 0.85)) * (0.88 + 0.12 * nz);
            const lit = (nx * Lx + ny * Ly) * 0.5 + 0.5;
            pRim[i] = Math.pow(1 - nz, 3.2) * (0.15 + 0.85 * Math.min(1, Math.max(0, lit)));
            pLon[i] = Math.atan2(nx, nz);
            const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
            pRow[i] = Math.floor((lat / Math.PI + 0.5) * (TEX_H - 1)) * TEX_W;
            pPole[i] = Math.abs(lat) / (Math.PI / 2);
            pRingBand[i] = smooth(0, 1, 1 - Math.abs(lat - 0.34) / 0.075);
            const hd = Math.max(0, (nx * Hx + ny * Hy + nz * Hz) / hl);
            pSpec[i] = Math.pow(hd, 60) * 0.3 + Math.pow(hd, 10) * 0.05;
            idx.push(i);
          } else if (dist <= Rp * 1.14) {
            // faint atmosphere haze just outside the edge
            const gl = 1 - (dist - Rp) / (Rp * 0.14);
            const lit = Math.max(0, (dx * Lx + dy * Ly) / (dist * lxy));
            pRow[i] = GLOW;
            pRim[i] = gl * gl * 0.28 * (0.15 + 0.85 * lit);
            idx.push(i);
          }
        }
      }
      pIdx = Uint32Array.from(idx);
      planetTurns = -9;
    }

    function renderPlanet(turns: number) {
      if (!pCtx || !pImg) return;
      const data = pImg.data;
      const { height, relief, moist, cloud, lights } = earthTextures();
      for (let n = 0; n < pIdx.length; n++) {
        const i = pIdx[n];
        const o = i * 4;
        const row = pRow[i];
        if (row === GLOW) {
          data[o] = 70;
          data[o + 1] = 170;
          data[o + 2] = 255;
          data[o + 3] = pRim[i] * 255;
          continue;
        }
        if (PLANET_STYLE === "blue") {
          let ub = pLon[i] / TAU + 0.5 + turns * 0.8;
          ub -= Math.floor(ub);
          const lat01 = row / TEX_W / (TEX_H - 1);
          const cvn = sampleU(cloud, row, ub) / 255;
          const hn = sampleU(height, row, ub) / 255;
          const band = 0.5 + 0.5 * Math.sin(lat01 * TAU * 2.4 + hn * 3.4 + cvn * 1.8);
          const litb = Math.min(1, Math.max(0, (pShade[i] - 0.22) / 0.85));
          const swirl = (0.3 * band + 0.7 * cvn) * litb;
          const rimb = Math.pow(pRim[i], 1.2);
          const spb = pSpec[i] * 0.9;
          data[o] = Math.min(255, 5 + 34 * litb + 84 * swirl + 185 * rimb + 200 * spb);
          data[o + 1] = Math.min(255, 32 + 104 * litb + 92 * swirl + 222 * rimb + 220 * spb);
          data[o + 2] = Math.min(255, 116 + 112 * litb + 40 * swirl + 255 * rimb + 240 * spb);
          data[o + 3] = pAlpha[i] * 255;
          continue;
        }
        let u = pLon[i] / TAU + 0.5 + turns;
        u -= Math.floor(u);
        let uc = pLon[i] / TAU + 0.5 + turns * 1.3 + 0.37; // clouds drift a little faster
        uc -= Math.floor(uc);
        const h = sampleU(height, row, u) / 255;
        const rel = sampleU(relief, row, u) / 255;
        const mo = sampleU(moist, row, u) / 255;
        const cv = Math.min(1, sampleU(cloud, row, uc) / 255);
        const cshadow = sampleU(cloud, row, (uc + 0.994) % 1) / 255;
        const pole = pPole[i];

        // ocean: deep navy, turquoise only in shallow water near coasts
        const shallow = smooth(0.9, 1.0, Math.min(1, h / EARTH_SEA));
        const oR = 8 + 8 * mo + 34 * shallow;
        const oG = 40 + 22 * mo + 90 * shallow;
        const oB = 110 + 30 * mo + 70 * shallow;

        // land: muted greens, tans, rock and snow
        const t = Math.max(0, (h - EARTH_SEA) / (1 - EARTH_SEA));
        const arid = Math.max(0, 1 - Math.abs(pole - 0.28) / 0.15) * 0.35;
        const green = smooth(0.3, 0.55, mo - arid);
        let lr = 172 + (56 - 172) * green;
        let lg = 146 + (86 - 146) * green;
        let lb = 102 + (44 - 102) * green;
        const tundra = smooth(0.6, 0.8, pole) * 0.7;
        lr += (128 - lr) * tundra;
        lg += (124 - lg) * tundra;
        lb += (110 - lb) * tundra;
        const rock = smooth(0.35, 0.65, t + rel * 0.2);
        lr += (118 - lr) * rock;
        lg += (104 - lg) * rock;
        lb += (92 - lb) * rock;
        const snow = smooth(0.78, 0.95, t + rel * 0.1);
        lr += (238 - lr) * snow;
        lg += (240 - lg) * snow;
        lb += (244 - lb) * snow;
        const detail = 0.78 + 0.44 * rel;
        lr *= detail;
        lg *= detail;
        lb *= detail;

        // soft coastline
        const lw = smooth(EARTH_SEA - 0.012, EARTH_SEA + 0.012, h);
        let r = oR + (lr - oR) * lw;
        let gg = oG + (lg - oG) * lw;
        let b = oB + (lb - oB) * lw;
        const ice = Math.min(1, Math.max(0, (pole - 0.83 + (h - 0.5) * 0.08) / 0.06));
        r += (236 - r) * ice;
        gg += (242 - gg) * ice;
        b += (248 - b) * ice;

        const sh = pShade[i];
        const shadow = (1 - 0.38 * cshadow * (1 - cv)) * (1 - 0.5 * pRingBand[i]); // cloud + ring shadows
        const gain = 1.4; // brighter globe
        let sr = r * sh * shadow * gain;
        let sg = gg * sh * shadow * gain;
        let sb = b * sh * shadow * (gain + 0.15);
        if (lw < 0.5 && ice < 0.5) {
          const sp = pSpec[i] * (1 - cv) * (1 - lw * 2) * 0.8; // sun glint on the sea
          sr += 255 * sp;
          sg += 250 * sp;
          sb += 235 * sp;
        }
        const night = Math.max(0, 1 - sh * 3.2);
        if (lw > 0.5 && night > 0 && lights[row + (Math.floor(u * TEX_W) % TEX_W)] > 0) {
          const li = night * (1 - cv) * 0.85; // city lights on the dark side
          sr += 255 * li;
          sg += 196 * li;
          sb += 110 * li;
        }
        const cs = 252 * Math.min(1, sh * 1.05 + 0.03);
        sr += (cs - sr) * cv;
        sg += (cs - sg) * cv;
        sb += (cs * 1.02 - sb) * cv;
        const lum = sr * 0.3 + sg * 0.55 + sb * 0.15;
        sr = lum + (sr - lum) * 0.9;
        sg = lum + (sg - lum) * 0.9;
        sb = lum + (sb - lum) * 0.9;
        const haze = pRim[i] * 0.9; // thin atmosphere on the lit limb
        data[o] = Math.min(255, sr + 84 * haze);
        data[o + 1] = Math.min(255, sg + 150 * haze);
        data[o + 2] = Math.min(255, sb + 255 * haze);
        data[o + 3] = pAlpha[i] * 255;
      }
      pCtx.putImageData(pImg, 0, 0);
    }

    const ringTex: (HTMLCanvasElement | null)[] = [null, null, null];
    let lightDark: HTMLCanvasElement | null = null;
    let lightGlow: HTMLCanvasElement | null = null;

    function bakeLight(k: number, size: number, R: number, coreR: number) {
      lightDark = lightDark ?? document.createElement("canvas");
      lightGlow = lightGlow ?? document.createElement("canvas");
      for (const cv of [lightDark, lightGlow]) {
        cv.width = size;
        cv.height = size;
      }
      const d = lightDark.getContext("2d");
      const w = lightGlow.getContext("2d");
      if (!d || !w) return;
      d.translate(size / 2, size / 2);
      d.scale(k, k);
      w.translate(size / 2, size / 2);
      w.scale(k, k);
      // shadow cast by the planet across the rings, pointing away from the light
      d.save();
      d.rotate(0.15);
      const shLen = R * 1.5;
      const shW = coreR * 0.95;
      for (let q = 0; q < 10; q++) {
        const a = 0.2 * Math.pow(1 - q / 10, 0.8);
        const sg = d.createLinearGradient(0, -shW * 1.25, 0, shW * 1.25);
        sg.addColorStop(0, "rgba(1,4,16,0)");
        sg.addColorStop(0.22, `rgba(1,4,16,${a})`);
        sg.addColorStop(0.78, `rgba(1,4,16,${a})`);
        sg.addColorStop(1, "rgba(1,4,16,0)");
        d.fillStyle = sg;
        d.fillRect((q / 10) * shLen, -shW * 1.25, shLen / 10 + 1, shW * 2.5);
      }
      d.restore();
      if (typeof d.createConicGradient === "function") {
        const cg = d.createConicGradient(0, 0, 0);
        const lg = w.createConicGradient(0, 0, 0);
        const lg2 = w.createConicGradient(0, 0, 0);
        for (let q = 0; q <= 36; q++) {
          const a = (q / 36) * TAU;
          cg.addColorStop(q / 36, `rgba(1,4,18,${(Math.pow(Math.max(0, Math.cos(a)), 1.3) * 0.16).toFixed(3)})`);
          const lobe = Math.pow(Math.max(0, Math.cos(a - Math.PI)), 2.4);
          lg.addColorStop(q / 36, `rgba(90,190,255,${(0.05 * lobe).toFixed(3)})`);
          lg2.addColorStop(q / 36, `rgba(225,246,255,${(0.08 * lobe).toFixed(3)})`);
        }
        d.strokeStyle = cg;
        d.lineWidth = R * 1.1;
        d.beginPath();
        d.arc(0, 0, R * 0.85, 0, TAU);
        d.stroke();
        w.strokeStyle = lg;
        w.lineWidth = R * 0.44;
        w.beginPath();
        w.arc(0, 0, R * 0.42, 0, TAU);
        w.stroke();
        w.strokeStyle = lg2;
        w.lineWidth = R * 0.1;
        w.beginPath();
        w.arc(0, 0, R * 0.99, 0, TAU);
        w.stroke();
      }
    }
    let texHalf = 0;

    function bakeRings(dpr: number) {
      const R = layout().radius;
      const k = Math.min(dpr, 1.25);
      texHalf = R * 1.4;
      const size = Math.ceil(texHalf * 2 * k);
      bakeLight(k, size, R, coreOf(R));
      const zones: [number, number][] = [
        [0.2, 0.64],
        [0.64, 1.08],
        [1.08, 1.26],
      ];
      zones.forEach((_, zi) => {
        const tc = ringTex[zi] ?? document.createElement("canvas");
        ringTex[zi] = tc;
        tc.width = size;
        tc.height = size;
        const c = tc.getContext("2d");
        if (!c) return;
        c.clearRect(0, 0, size, size);
        c.translate(size / 2, size / 2);
        c.scale(k, k);
        c.lineCap = "round";
        const seed = zi * 10000;
        const arc = (r: number, a0: number, len: number) => {
          c.beginPath();
          c.arc(0, 0, R * r, a0, a0 + len);
          c.stroke();
        };
        const ringGradient = (r0: number, r1: number, stops: [number, string][]) => {
          const gr = c.createRadialGradient(0, 0, R * r0, 0, 0, R * r1);
          for (const [t, col] of stops) gr.addColorStop(t, col);
          c.strokeStyle = gr;
          c.lineWidth = R * (r1 - r0);
          c.beginPath();
          c.arc(0, 0, (R * (r0 + r1)) / 2, 0, TAU);
          c.stroke();
        };
        const speck = (r: number, a: number, sz: number, col: string) => {
          c.fillStyle = col;
          c.fillRect(Math.cos(a) * R * r, Math.sin(a) * R * r, sz, sz);
        };
        const n1 = (x: number) => vnoise(x, 0.5, 1e6);
        const softStreak = (r: number, a0: number, len: number, w: number, rgb: string, al: number) => {
          streak(r, a0, len, w * 3.2, rgb, al * 0.22);
          streak(r, a0, len, w, rgb, al);
        };
        const streak = (r: number, a0: number, len: number, w: number, rgb: string, al: number) => {
          for (let k = 0; k < 3; k++) {
            const f = 1 - k * 0.32;
            const off = (len * (1 - f)) / 2;
            c.strokeStyle = `rgba(${rgb},${al * (0.35 + k * 0.33)})`;
            c.lineWidth = w * (0.7 + k * 0.2);
            arc(r, a0 + off, len * f);
          }
        };

        const wander = (r: number, a0: number, len: number, w: number, rgb: string, al: number, amp: number, ph: number) => {
          const steps = Math.max(8, Math.ceil(len * 16));
          const slope = (rnd(ph + 9) - 0.5) * amp * 1.4;
          const pt = (t: number): [number, number] => {
            const a = a0 + len * t;
            const rr = r + amp * (n1(t * 2.4 + ph * 0.37) - 0.5) * 2 + slope * (t - 0.5);
            return [Math.cos(a) * R * rr, Math.sin(a) * R * rr];
          };
          for (let pass = 0; pass < 3; pass++) {
            const t0 = pass * 0.12;
            const t1 = 1 - pass * 0.12;
            c.strokeStyle = `rgba(${rgb},${al * (0.3 + pass * 0.35)})`;
            c.lineWidth = w * (1.5 - pass * 0.4);
            c.beginPath();
            for (let i = 0; i <= steps; i++) {
              const [x, y] = pt(t0 + (t1 - t0) * (i / steps));
              if (i === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
            }
            c.stroke();
          }
        };

        if (zi === 0) {
          ringGradient(0, 0.2, [
        [0, "rgba(190,242,255,0.97)"],
        [1, "rgba(170,236,255,0.96)"],
      ]);
      ringGradient(0.2, 0.68, [
            [0, "rgba(150,225,255,0.98)"],
            [0.07, "rgba(70,190,255,0.98)"],
            [0.15, "rgba(30,120,255,0.97)"],
            [0.24, "rgba(6,40,170,0.97)"],
            [0.32, "rgba(90,205,255,0.98)"],
            [0.4, "rgba(120,205,255,0.98)"],
            [0.47, "rgba(40,140,255,0.97)"],
            [0.56, "rgba(5,30,150,0.97)"],
            [0.65, "rgba(60,170,255,0.98)"],
            [0.72, "rgba(110,195,255,0.98)"],
            [0.8, "rgba(20,80,230,0.97)"],
            [0.9, "rgba(4,22,120,0.96)"],
            [1, "rgba(2,12,70,0.94)"],
          ]);
          for (const rr of [0.3, 0.4, 0.5, 0.6]) {
            ringGradient(rr - 0.045, rr, [
              [0, "rgba(4,22,105,0)"],
              [1, "rgba(4,22,105,0.38)"],
            ]);
            ringGradient(rr, rr + 0.03, [
              [0, "rgba(170,228,255,0.32)"],
              [1, "rgba(120,200,255,0)"],
            ]);
          }
          // broad, uneven smudges whose paths wander instead of following perfect circles
          for (let q = 0; q < 30; q++) {
            const h = seed + q * 5.3;
            const bright = rnd(h + 2) < 0.5;
            wander(0.22 + rnd(h + 1) * 0.4, rnd(h + 3) * TAU, 0.8 + rnd(h + 4) * 2.2, R * (0.018 + rnd(h + 5) * 0.03), bright ? "150,220,255" : "8,40,150", bright ? 0.12 : 0.18, 0.02, h);
          }
          c.globalCompositeOperation = "lighter";
          // long white-cyan swooshes, some hugging the band edges
          for (let q = 0; q < 26; q++) {
            const h = seed + 3000 + q * 4.1;
            const edge = q % 3 === 0 ? [0.3, 0.4, 0.5, 0.6][q % 4] + (rnd(h + 8) - 0.5) * 0.01 : 0.24 + rnd(h + 1) * 0.42;
            wander(edge, rnd(h + 2) * TAU, 0.8 + rnd(h + 3) * 2.2, R * (0.007 + rnd(h + 4) * 0.012), rnd(h + 5) < 0.6 ? "200,238,255" : "110,200,255", 0.28 + rnd(h + 6) * 0.35, 0.012, h);
          }
          c.globalCompositeOperation = "source-over";
        } else if (zi === 1) {
          // near-black base
          ringGradient(0.68, 1.0, [
            [0, "rgba(8,34,130,0.9)"],
            [0.04, "rgba(2,8,30,0.97)"],
            [1, "rgba(1,4,14,0.97)"],
          ]);
          // one narrow smooth luminous band hugging the inner disc
          ringGradient(0.69, 0.735, [
            [0, "rgba(8,40,160,0)"],
            [0.2, "rgba(30,112,245,0.8)"],
            [0.5, "rgba(90,200,255,0.97)"],
            [0.8, "rgba(30,112,245,0.8)"],
            [1, "rgba(8,40,160,0)"],
          ]);
          c.strokeStyle = "rgba(225,245,255,0.7)";
          c.lineWidth = Math.max(0.8, R * 0.004);
          arc(0.7, 0, TAU);
          // faint blue haze on the inner edge of the wide dark ring
          ringGradient(0.735, 0.775, [
            [0, "rgba(30,100,235,0.22)"],
            [1, "rgba(30,100,235,0)"],
          ]);
          // where specks and scratches land: mostly the wide dark ring (0.75 .. 0.935)
          const laneR = (h: number, bright: boolean) => {
            let r = 0.74 + rnd(h + 1) * 0.17;
            for (let t = 1; t < 6 && (laneAt(r) >= 0.5) === bright === false; t++) r = 0.74 + rnd(h + 1 + t * 13.1) * 0.17;
            return r;
          };
          const pickR = (h: number) => {
            const k = rnd(h);
            if (k < 0.82) return laneR(h, true);
            if (k < 0.9) return 0.695 + rnd(h + 1) * 0.04;
            return 0.91 + rnd(h + 1) * 0.025;
          };
          // a blob: a dot, or a short smear along the orbit (round caps make it soft)
          const blob = (r: number, a: number, w: number, smear: number, col: string) => {
            c.strokeStyle = col;
            c.lineWidth = w;
            arc(r, a, (w / (R * r)) * smear);
          };
          for (let q = 0; q < 22000; q++) {
            const h = seed + 30000 + q * 2.9;
            speck(laneR(h, false), rnd(h + 3) * TAU, Math.max(0.8, R * (0.003 + rnd(h + 4) * 0.006)), `rgba(1,4,14,${0.6 + rnd(h + 5) * 0.4})`);
          }
          // chunky dark clumps that break the ring into ragged pieces
          for (let q = 0; q < 2600; q++) {
            const h = seed + 70000 + q * 3.3;
            blob(laneR(h, false), rnd(h + 4) * TAU, R * (0.005 + rnd(h + 2) * 0.011), 0.3 + rnd(h + 5) * 2.5, `rgba(1,4,14,${0.75 + rnd(h + 3) * 0.25})`);
          }
          // pale silver band just inside the glowing line
          ringGradient(0.9, 0.95, [
            [0, "rgba(190,205,230,0)"],
            [0.35, "rgba(190,208,235,0.5)"],
            [0.7, "rgba(205,225,250,0.62)"],
            [1, "rgba(120,190,255,0.35)"],
          ]);
          c.globalCompositeOperation = "lighter";
          // fine concentric scratches
          for (let q = 0; q < 40; q++) {
            const h = seed + 1000 + q * 4.37;
            const k = rnd(h + 3);
            const rgb = k < 0.3 ? "238,248,255" : k < 0.62 ? "115,205,255" : "40,125,245";
            const w = Math.max(0.55, R * (0.0012 + Math.pow(rnd(h + 2), 2) * 0.0035));
            wander(pickR(h), rnd(h + 5) * TAU, 0.1 + Math.pow(rnd(h + 6), 1.8) * 1.3, w, rgb, 0.2 + rnd(h + 4) * 0.5, 0.006, h);
          }
          // short brush dabs whose direction wanders off the orbit, like paint flicks
          for (let q = 0; q < 11000; q++) {
            const h = seed + 150000 + q * 2.37;
            const r = 0.7 + Math.pow(rnd(h + 1), 0.9) * 0.2;
            const a = rnd(h + 2) * TAU;
            const x = Math.cos(a) * R * r;
            const y = Math.sin(a) * R * r;
            const d = a + Math.PI / 2 + (rnd(h + 3) - 0.5) * (rnd(h + 9) < 0.3 ? 2.8 : 0.8);
            const len = R * (0.008 + Math.pow(rnd(h + 4), 1.8) * 0.05);
            const t = rnd(h + 6);
            if (t >= 0.62 ? laneAt(r) > 0.5 : laneAt(r) < 0.42) continue;
            const al = 0.55 + rnd(h + 8) * 0.45;
            c.strokeStyle = t < 0.28 ? `rgba(246,251,255,${al * 0.9})` : t < 0.46 ? `rgba(120,212,255,${al * 0.85})` : t < 0.62 ? `rgba(40,118,242,${al * 0.85})` : `rgba(1,4,14,${al})`;
            c.lineWidth = Math.max(1, R * (0.003 + rnd(h + 5) * 0.006));
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(d) * len, y + Math.sin(d) * len);
            c.stroke();
          }
          // fine grain
          for (let q = 0; q < 3500; q++) {
            const h = seed + 20000 + q * 3.17;
            const w = rnd(h + 6);
            const al = 0.45 + rnd(h + 7) * 0.5;
            const col = w < 0.34 ? `rgba(238,248,255,${al})` : w < 0.64 ? `rgba(125,205,255,${al})` : `rgba(55,125,238,${al})`;
            speck(pickR(h), rnd(h + 4) * TAU, Math.max(0.7, R * (0.0022 + rnd(h + 5) * 0.0035)), col);
          }
          // chunky bright clumps, thicker toward both edges of the dark ring
          for (let q = 0; q < 1200; q++) {
            const h = seed + 60000 + q * 3.9;
            let r = 0.74 + Math.pow(rnd(h + 1), rnd(h + 7) < 0.5 ? 1.8 : 0.55) * 0.17;
            if (laneAt(r) < 0.45) r = laneR(h + 2, true);
            const pick = rnd(h + 4);
            const al = 0.5 + rnd(h + 5) * 0.45;
            const col = pick < 0.42 ? `rgba(238,248,255,${al})` : pick < 0.72 ? `rgba(120,200,255,${al})` : `rgba(45,120,240,${al})`;
            blob(r, rnd(h + 6) * TAU, R * (0.004 + rnd(h + 3) * 0.008), 0.2 + rnd(h + 2) * 2.4, col);
          }
          // the continuous glowing line: wide soft halo, bright blue body, pale core; brightness drifts around it
          const steps = 240;
          c.lineCap = "butt";
          for (let q = 0; q < steps; q++) {
            const a0 = (q / steps) * TAU;
            const br = 0.5 + 0.5 * n1(a0 * 2.6 + 9.3);
            const wob = (n1(a0 * 5 + 2.2) - 0.5) * 0.008;
            const piece = (TAU / steps) * 1.04;
            c.strokeStyle = `rgba(30,125,255,${0.08 + 0.12 * br})`;
            c.lineWidth = R * (0.11 + 0.05 * br);
            arc(0.935 + wob, a0, piece);
            c.strokeStyle = `rgba(50,170,255,${0.75 + 0.2 * br})`;
            c.lineWidth = R * (0.04 + 0.016 * br);
            arc(0.935 + wob, a0, piece);
            c.strokeStyle = `rgba(170,225,255,${0.4 + 0.3 * br})`;
            c.lineWidth = Math.max(1.2, R * (0.007 + 0.008 * br));
            arc(0.933 + wob, a0, piece);
          }
          c.lineCap = "round";
          c.globalCompositeOperation = "source-over";
        } else {
          // belt: deep blue haze, then big soft blobs in rows along the orbit (blue / grey / white, a few orange and yellow)
          ringGradient(0.96, 1.16, [
            [0, "rgba(12,50,170,0.32)"],
            [0.25, "rgba(16,70,200,0.4)"],
            [0.6, "rgba(8,36,130,0.24)"],
            [1, "rgba(4,20,80,0)"],
          ]);
          const rows = 28;
          for (let q = 0; q < 14000; q++) {
            const h = seed + q * 2.71;
            const row = Math.floor(rnd(h + 1) * rows);
            const fr = row / rows;
            if (rnd(h + 8) < fr * 0.45) continue; // rows thin out toward the outside
            const r = 1.0 + fr * 0.13 + (rnd(h + 2) - 0.5) * 0.012;
            const pick = rnd(h + 4);
            const al = 0.55 + rnd(h + 5) * 0.4;
            const col =
              pick < 0.42 ? `rgba(35,100,232,${al})`
              : pick < 0.62 ? `rgba(90,160,255,${al})`
              : pick < 0.77 ? `rgba(140,160,195,${al})`
              : pick < 0.88 ? `rgba(212,222,238,${al})`
              : pick < 0.92 ? `rgba(255,160,60,${al})`
              : pick < 0.96 ? `rgba(255,215,80,${al})`
              : `rgba(3,8,30,${al})`;
            const w = R * (0.004 + Math.pow(rnd(h + 3), 1.4) * 0.016);
            c.strokeStyle = col;
            c.lineWidth = w;
            arc(r, rnd(h + 6) * TAU, (w / (R * r)) * (0.2 + rnd(h + 7) * 1.8));
          }
          // grainy confetti out to the ragged edge: tiny blue, white, orange and yellow specks
          for (let q = 0; q < 16000; q++) {
            const h = seed + 90000 + q * 2.13;
            const f = Math.pow(rnd(h + 1), 1.25);
            if (rnd(h + 8) < f * 0.8) continue;
            const w = rnd(h + 4);
            const al = 0.55 + rnd(h + 5) * 0.45;
            c.fillStyle =
              w < 0.3 ? `rgba(240,248,255,${al})` : w < 0.55 ? `rgba(125,212,255,${al})` : w < 0.92 ? `rgba(45,125,240,${al})` : w < 0.96 ? `rgba(255,176,64,${al})` : `rgba(255,224,112,${al})`;
            const a = rnd(h + 2) * TAU;
            const rr = 1.0 + f * 0.15;
            const sz = Math.max(0.7, R * (0.0018 + rnd(h + 3) * 0.004));
            c.fillRect(Math.cos(a) * R * rr, Math.sin(a) * R * rr, sz, sz);
          }
        }
      });
    }

    function dot(x: number, y: number, sz: number) {
      if (sz < 1.5) g.fillRect(x - sz, y - sz, sz * 2, sz * 2);
      else {
        g.beginPath();
        g.arc(x, y, sz, 0, TAU);
        g.fill();
      }
    }

    function drawComet(m: Comet) {
      const sp = Math.hypot(m.vx, m.vy) || 1;
      const ux = m.vx / sp;
      const uy = m.vy / sp;
      const tx = m.x - ux * m.len;
      const ty = m.y - uy * m.len;
      g.save();
      g.globalCompositeOperation = "lighter";
      g.lineCap = "round";
      const tg = g.createLinearGradient(m.x, m.y, tx, ty);
      tg.addColorStop(0, `rgba(${m.rgb},0.9)`);
      tg.addColorStop(0.35, `rgba(${m.rgb},0.3)`);
      tg.addColorStop(1, `rgba(${m.rgb},0)`);
      g.strokeStyle = tg;
      g.beginPath();
      g.moveTo(m.x, m.y);
      g.lineTo(tx, ty);
      g.lineWidth = m.size * 3.4;
      g.globalAlpha = 0.32;
      g.stroke();
      g.lineWidth = m.size * 1.1;
      g.globalAlpha = 0.95;
      g.stroke();
      // sparks shed along the tail
      g.fillStyle = `rgb(${m.rgb})`;
      for (let k = 0; k < 12; k++) {
        const f = rnd(k * 3.1 + m.len) * 0.9;
        const px = m.x - ux * m.len * f + (rnd(k * 7.7 + m.size) - 0.5) * m.size * 5;
        const py = m.y - uy * m.len * f + (rnd(k * 5.3 + m.size) - 0.5) * m.size * 5;
        g.globalAlpha = (1 - f) * 0.65;
        g.fillRect(px, py, 1.3, 1.3);
      }
      const hg = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 5.5);
      hg.addColorStop(0, "rgba(255,255,255,0.98)");
      hg.addColorStop(0.25, `rgba(${m.rgb},0.55)`);
      hg.addColorStop(1, `rgba(${m.rgb},0)`);
      g.globalAlpha = 1;
      g.fillStyle = hg;
      g.beginPath();
      g.arc(m.x, m.y, m.size * 5.5, 0, TAU);
      g.fill();
      g.restore();
    }

    function drawWorld(w: World, px: number, py: number, rad: number) {
      g.save();
      g.globalAlpha = 0.92;
      // soft glow
      const halo = g.createRadialGradient(px, py, rad * 0.8, px, py, rad * 2.4);
      halo.addColorStop(0, `rgba(${w.glow},0.22)`);
      halo.addColorStop(1, `rgba(${w.glow},0)`);
      g.fillStyle = halo;
      g.fillRect(px - rad * 2.5, py - rad * 2.5, rad * 5, rad * 5);
      const ring = (front: boolean) => {
        g.save();
        g.translate(px, py);
        g.rotate(-0.38);
        g.scale(1, 0.3);
        g.beginPath();
        if (front) g.arc(0, 0, rad * 1.75, 0, Math.PI);
        else g.arc(0, 0, rad * 1.75, Math.PI, TAU);
        g.strokeStyle = "rgba(230,245,235,0.55)";
        g.lineWidth = rad * 0.3;
        g.stroke();
        g.restore();
      };
      if (w.kind === "ringed") ring(false);
      // lit sphere
      const sg = g.createRadialGradient(px - rad * 0.4, py - rad * 0.42, rad * 0.08, px, py, rad);
      sg.addColorStop(0, w.c[0]);
      sg.addColorStop(0.55, w.c[1]);
      sg.addColorStop(1, w.c[2]);
      g.fillStyle = sg;
      g.beginPath();
      g.arc(px, py, rad, 0, TAU);
      g.fill();
      g.save();
      g.beginPath();
      g.arc(px, py, rad, 0, TAU);
      g.clip();
      if (w.kind === "gas") {
        for (let k = 0; k < 6; k++) {
          const yy = py - rad + (k + 0.6) * ((rad * 2) / 6.4);
          g.strokeStyle = k % 2 ? "rgba(90,45,15,0.28)" : "rgba(255,235,200,0.2)";
          g.lineWidth = rad * 0.16;
          g.beginPath();
          g.moveTo(px - rad, yy);
          g.lineTo(px + rad, yy + rad * 0.06);
          g.stroke();
        }
      }
      if (w.kind === "rock" || w.kind === "ice") {
        for (let k = 0; k < 5; k++) {
          g.fillStyle = w.kind === "rock" ? "rgba(60,20,10,0.25)" : "rgba(40,90,140,0.2)";
          g.beginPath();
          g.arc(px + (rnd(k * 3.3) - 0.5) * rad, py + (rnd(k * 5.1) - 0.5) * rad, rad * (0.12 + rnd(k * 7.7) * 0.16), 0, TAU);
          g.fill();
        }
      }
      // night side, away from the light
      const sh = g.createRadialGradient(px - rad * 0.55, py - rad * 0.55, rad * 0.6, px - rad * 0.55, py - rad * 0.55, rad * 1.9);
      sh.addColorStop(0, "rgba(2,6,22,0)");
      sh.addColorStop(1, "rgba(2,6,22,0.78)");
      g.fillStyle = sh;
      g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      g.restore();
      if (w.kind === "ringed") ring(true);
      g.restore();
    }

    function draw(t: number) {
      g.clearRect(0, 0, width, height);
      g.drawImage(bg, 0, 0, width, height);

      for (const s of stars) {
        if (!s.live) continue;
        const a = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.002 + s.tw));
        g.fillStyle = `rgba(200,225,255,${a})`;
        g.beginPath();
        g.arc(s.x * width - driftX * 10 * s.size, s.y * height - driftY * 8 * s.size, s.size * 1.2, 0, TAU);
        g.fill();
      }

      /* far-away worlds drifting slowly across the sky (slight parallax with the pointer) */
      const wk = Math.min(1.25, Math.max(0.6, Math.min(width, height) / 700));
      const margin = 70;
      for (const w of WORLDS) {
        const span = width + margin * 2;
        const px = ((((w.x0 * width + (w.vx * t) / 1000) % span) + span) % span) - margin - driftX * 14;
        const spanY = height + margin * 2;
        const py = ((((w.y0 * height + (w.vy * t) / 1000) % spanY) + spanY) % spanY) - margin - driftY * 10;
        drawWorld(w, px, py, w.r * wk);
      }

      /* comets that pass behind the galaxy */
      for (const m of comets) if (!m.front) drawComet(m);

      const L = layout();
      const radius = L.radius;
      const cx = L.cx + driftX * (hero ? 5 : 16);
      const cy = L.cy + driftY * (hero ? 4 : 12);
      const tilt = TILT + driftY * 0.04;
      const core = coreOf(radius);
      const sizeK = Math.min(1.15, Math.max(0.55, radius / 300));
      // the planet floats above the ring plane, toward the viewer: its centre sits up-left of the disc centre
      const planetX = -0.12 * radius;
      const planetY = -0.175 * radius;

      /* project every particle once per frame */
      for (let i = 0; i < n; i++) {
        if (prank[i] > quality) {
          al[i] = 0;
          continue;
        }
        const p = particles[i];
        const a = p.phase + angle * p.speed;
        const depth = Math.sin(a);
        const persp = 2.8 / (2.8 - depth * 0.55);
        const tw = 0.7 + 0.3 * Math.sin(t * 0.004 + p.tw);
        xs[i] = Math.cos(a) * p.r * radius * persp;
        ys[i] = (depth * p.r * tilt + p.z) * radius * persp;
        ss[i] = p.size * persp * sizeK;
        ds[i] = depth;
        const lit = Math.min(1, Math.max(0, 0.5 - 0.5 * (xs[i] / (radius * 1.2)) + (ys[i] / (radius * 1.2)) * 0.12));
        al[i] = p.kind === 4 ? 0.85 : Math.min(1, (p.dust ? 0.5 : 0.62 + (1 - Math.abs(depth)) * 0.3) * tw * (0.58 + 0.3 * lit));
      }

      /* infalling dust and stars: far out, they spiral toward the rings, speed up, then fade */
      for (let i = 0; i < im; i++) {
        const p = infall[i];
        if (p.tw / TAU > quality) {
          ial[i] = 0;
          continue;
        }
        const f = (p.p0 + t * 0.000011 * p.speed) % 1;
        const rr = p.rIn + (p.rOut - p.rIn) * (1 - f * f);
        const a = p.phase + p.spin * f + (angle * 0.6) / Math.pow(rr, 1.5);
        const depth = Math.sin(a);
        const persp = 2.8 / (2.8 - depth * 0.55);
        ix[i] = Math.cos(a) * rr * radius * persp;
        iy[i] = (depth * rr * tilt + p.z * rr) * radius * persp;
        const f2 = Math.max(0, f - 0.03);
        const r2 = p.rIn + (p.rOut - p.rIn) * (1 - f2 * f2);
        const a2 = p.phase + p.spin * f2 + (angle * 0.6) / Math.pow(r2, 1.5);
        const d2 = Math.sin(a2);
        const pe2 = 2.8 / (2.8 - d2 * 0.55);
        itx[i] = Math.cos(a2) * r2 * radius * pe2;
        ity[i] = (d2 * r2 * tilt + p.z * r2) * radius * pe2;
        isz[i] = p.size * persp * sizeK * (0.7 + 0.5 * (1 - f));
        ial[i] = Math.pow(Math.sin(f * Math.PI), 0.7) * (0.55 + 0.45 * Math.sin(t * 0.004 + p.tw));
        ids[i] = depth;
      }

      g.save();
      g.translate(cx, cy);
      g.rotate(TILT_ANGLE);

      /* soft glow around the disc */
      g.globalCompositeOperation = "lighter";
      const halo = g.createRadialGradient(0, 0, 10, 0, 0, radius * 1.2);
      halo.addColorStop(0, "rgba(40,150,255,0.2)");
      halo.addColorStop(0.3, "rgba(20,100,255,0.11)");
      halo.addColorStop(0.7, "rgba(30,90,230,0.06)");
      halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo;
      g.fillRect(-radius * 1.3, -radius * 1.3, radius * 2.6, radius * 2.6);
      g.globalCompositeOperation = "source-over";

      function drawRingLayer(front: boolean) {
        g.save();
        g.beginPath();
        if (front) g.rect(-radius * 1.6, 0, radius * 3.2, radius * 1.6);
        else g.rect(-radius * 1.6, -radius * 1.6, radius * 3.2, radius * 1.6);
        g.clip();
        g.save();
        g.scale(1, tilt); // circles become the tilted disc
        for (let z = 0; z < 3; z++) {
          const tex = ringTex[z];
          if (!tex) continue;
          g.save();
          g.rotate(angle * ZONE_SPIN[z]);
          g.drawImage(tex, -texHalf, -texHalf, texHalf * 2, texHalf * 2);
          g.restore();
        }
        // lighting and the planet's shadow were baked once (bakeLight): two cheap bitmap draws per frame
        if (lightDark) g.drawImage(lightDark, -texHalf, -texHalf, texHalf * 2, texHalf * 2);
        if (lightGlow) {
          g.globalCompositeOperation = "lighter";
          g.drawImage(lightGlow, -texHalf, -texHalf, texHalf * 2, texHalf * 2);
          g.globalCompositeOperation = "source-over";
        }
        g.restore();
        g.restore();
      }

      function particlePass(front: boolean, dark: boolean) {
        g.save();
        g.globalCompositeOperation = dark ? "source-over" : "lighter";
        let lastKind = -1;
        for (let i = 0; i < n; i++) {
          const a = al[i];
          if (a <= 0 || ds[i] > 0 !== front) continue;
          const kind = pkind[i];
          if ((kind === 4) !== dark) continue;
          if (kind !== lastKind) {
            g.fillStyle = COLORS[kind];
            lastKind = kind;
          }
          g.globalAlpha = a;
          dot(xs[i], ys[i], ss[i]);
          if (glint[i]) {
            const gl = Math.pow(Math.max(0, Math.sin(t * 0.003 + particles[i].tw)), 6);
            if (gl > 0.05) {
              const rr = (ss[i] * 2 + 2.5) * (0.6 + gl);
              g.globalAlpha = gl * 0.8;
              g.drawImage(glowWhite, xs[i] - rr, ys[i] - rr, rr * 2, rr * 2);
              lastKind = -1; // fillStyle is unchanged, but alpha was touched: keep logic simple
            }
          }
        }
        g.restore();
      }

      /* golden orbits: glittering comet-like streams on tilted ellipses around the planet.
         front = nearer the viewer than the planet (drawn after it); the rest passes behind it */
      function goldPass(front: boolean) {
        if (!front) {
          for (let i = 0; i < goldN; i++) {
            if (grank[i] > quality) {
              gA[i] = 0;
              continue;
            }
            const d = gold[i];
            const o = GOLD_ORBITS[d.orbit];
            const phi = o.phi + o.prec * t;
            const th = o.theta + 0.08 * Math.sin(t * 0.0003 + d.orbit * 1.7);
            const u = ((d.u % 1) + 1) % 1;
            const ang = TAU * u + o.dir * o.spin * t;
            const a = o.a * (1 + d.off);
            const x1 = Math.cos(ang) * a;
            const y1 = Math.sin(ang) * a * o.e;
            const y2 = y1 * Math.cos(th);
            gX[i] = (x1 * Math.cos(phi) - y2 * Math.sin(phi)) * core;
            gY[i] = (x1 * Math.sin(phi) + y2 * Math.cos(phi)) * core;
            gZ[i] = y1 * Math.sin(th);
            const taper = 0.4 + 0.6 * Math.pow(o.dir > 0 ? u : 1 - u, 1.5); // bright head, fading tail behind it
            gA[i] = taper * (0.65 + 0.35 * Math.sin(t * 0.005 + d.tw));
          }
        }
        g.save();
        g.rotate(-TILT_ANGLE); // screen-aligned, like the planet
        g.translate(planetX, planetY); // orbits circle the planet, not the disc centre
        g.globalCompositeOperation = "source-over"; // "lighter" would turn gold white on the bright blue disc
        // a very faint thread along each orbit
        g.strokeStyle = "rgba(255,206,90,0.32)";
        g.lineWidth = 1;
        g.beginPath();
        for (const o of GOLD_ORBITS) {
          const k = GOLD_ORBITS.indexOf(o);
          const phi = o.phi + o.prec * t;
          const th = o.theta + 0.08 * Math.sin(t * 0.0003 + k * 1.7);
          let px = 0;
          let py = 0;
          let pz = 0;
          for (let s = 0; s <= 72; s++) {
            const ang = (s / 72) * TAU;
            const x1 = Math.cos(ang) * o.a;
            const y1 = Math.sin(ang) * o.a * o.e;
            const y2 = y1 * Math.cos(th);
            const x = (x1 * Math.cos(phi) - y2 * Math.sin(phi)) * core;
            const y = (x1 * Math.sin(phi) + y2 * Math.cos(phi)) * core;
            const z = y1 * Math.sin(th);
            if (s > 0 && (pz + z > 0) === front) {
              g.moveTo(px, py);
              g.lineTo(x, y);
            }
            px = x;
            py = y;
            pz = z;
          }
        }
        g.stroke();
        let lastGold = -1;
        for (let i = 0; i < goldN; i++) {
          if (gA[i] <= 0 || gZ[i] > 0 !== front) continue;
          const d = gold[i];
          const ps = 1 + 0.03 * gZ[i];
          const sz = d.size * sizeK * ps;
          g.globalAlpha = Math.min(1, gA[i]) * 0.95;
          if (d.kind !== lastGold) {
            g.fillStyle = GOLD_FILL[d.kind];
            lastGold = d.kind;
          }
          dot(gX[i], gY[i], sz);
          if (d.big) {
            const bs = (7 + d.size * 6) * sizeK * ps;
            g.globalAlpha = Math.min(1, gA[i]) * 0.6;
            g.drawImage(goldSprite, gX[i] - bs, gY[i] - bs, bs * 2, bs * 2);
          }
        }
        g.restore();
      }

      function infallPass(front: boolean) {
        g.save();
        g.globalCompositeOperation = "lighter";
        g.lineCap = "round";
        for (let i = 0; i < im; i++) {
          if (ids[i] > 0 !== front) continue;
          const al = ial[i];
          if (al < 0.03) continue;
          const p = infall[i];
          g.fillStyle = COLORS[p.kind];
          if (p.trail) {
            g.strokeStyle = COLORS[p.kind];
            g.lineWidth = Math.max(0.6, isz[i] * 0.9);
            g.globalAlpha = al * 0.5;
            g.beginPath();
            g.moveTo(itx[i], ity[i]);
            g.lineTo(ix[i], iy[i]);
            g.stroke();
          }
          g.globalAlpha = al;
          dot(ix[i], iy[i], isz[i]);
          if (p.big) {
            const rr = isz[i] * 3 + 5;
            g.globalAlpha = al * 0.8;
            g.drawImage(glowWhite, ix[i] - rr, iy[i] - rr, rr * 2, rr * 2);
            const arm = isz[i] * 5 + 4;
            g.globalAlpha = al * 0.7;
            g.strokeStyle = "#e8f6ff";
            g.lineWidth = 0.7;
            g.beginPath();
            g.moveTo(ix[i] - arm, iy[i]);
            g.lineTo(ix[i] + arm, iy[i]);
            g.moveTo(ix[i], iy[i] - arm);
            g.lineTo(ix[i], iy[i] + arm);
            g.stroke();
          }
        }
        g.restore();
      }

      drawRingLayer(false);
      particlePass(false, false);
      particlePass(false, true);
      infallPass(false);

      /* soft blue plate around the planet, inside the inner ring */
      g.save();
      g.globalCompositeOperation = "lighter";
      g.scale(1, tilt);
      const plate = g.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius * 0.62);
      plate.addColorStop(0, "rgba(70,200,255,0.3)");
      plate.addColorStop(0.6, "rgba(30,130,255,0.14)");
      plate.addColorStop(1, "rgba(20,90,255,0)");
      g.fillStyle = plate;
      g.beginPath();
      g.arc(0, 0, radius * 0.62, 0, TAU);
      g.fill();
      g.restore();

      drawRingLayer(true);
      goldPass(false);

      /* ---------- planet: lit, slowly rotating sphere ---------- */
      g.save();
      g.rotate(-TILT_ANGLE); // upright so light always comes from the upper-left
      g.translate(planetX, planetY);

      g.globalCompositeOperation = "lighter";
      const glow = g.createRadialGradient(0, 0, core * 0.8, 0, 0, core * 3.2);
      glow.addColorStop(0, "rgba(40,150,255,0.26)");
      glow.addColorStop(0.4, "rgba(20,90,255,0.1)");
      glow.addColorStop(1, "rgba(10,50,190,0)");
      g.fillStyle = glow;
      g.fillRect(-core * 3.4, -core * 3.4, core * 6.8, core * 6.8);
      g.globalCompositeOperation = "source-over";

      const turnsNow = angle * 0.35;
      if (Math.abs(turnsNow - planetTurns) > 0.002) {
        renderPlanet(turnsNow);
        planetTurns = turnsNow;
      }
      if (pCanvas) g.drawImage(pCanvas, -pS / (2 * pK), -pS / (2 * pK), pS / pK, pS / pK);
      g.restore();

      goldPass(true);
      particlePass(true, false);
      particlePass(true, true);
      infallPass(true);

      /* dust plumes flowing outward along the minor axis (orange / yellow / white specks) */
      ensurePlumeCache(radius, curDpr);
      for (let h = 0; h < 2; h++) {
        if (plumeDirty[h] || (h === plumeNext && t - plumeLast >= 125)) {
          renderPlumeHalf(h, t, radius, sizeK);
          plumeDirty[h] = false;
          if (h === plumeNext) {
            plumeLast = t;
            plumeNext ^= 1;
          }
        }
      }
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 1;
      for (const cv of plumeCv) g.drawImage(cv, -plumeOx(), -plumeOy(), cv.width / plumeK, cv.height / plumeK);
      // live sparkles: about one speck in five pulses with a soft bloom and a four-point glint
      for (let pi = 0; pi < plumes.length; pi += 5) {
        if (prankPlume[pi] > quality) continue;
        const p = plumes[pi];
        const f = (p.p0 + t * 0.000018 * p.speed) % 1;
        const fade = Math.sin(f * Math.PI);
        if (fade <= 0.02) continue;
        const pulse = Math.pow(Math.max(0, Math.sin(t * 0.0045 * (0.7 + p.speed * 0.5) + p.tw * 3)), 7);
        if (pulse <= 0.06) continue;
        const x = p.u * (0.7 + f) * radius + Math.sin(t * 0.0012 + p.tw) * radius * 0.015;
        const y = p.dir * (0.45 + f * 1.25) * radius;
        const psz = p.size * (1.25 - f * 0.4) * sizeK;
        const rr = (psz * 2.4 + 3) * (0.6 + pulse);
        const warm = p.kind === 2 || p.kind === 5;
        g.globalAlpha = fade * pulse * 0.6;
        g.drawImage(warm ? glowGold : p.kind === 0 ? glowBlue : glowWhite, x - rr, y - rr, rr * 2, rr * 2);
        const arm = rr * 2.2 * pulse + 1;
        g.globalAlpha = fade * pulse * 0.75;
        g.strokeStyle = warm ? "rgb(255,214,130)" : p.kind === 0 ? "rgb(140,200,255)" : "rgb(235,248,255)";
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(x - arm, y);
        g.lineTo(x + arm, y);
        g.moveTo(x, y - arm);
        g.lineTo(x, y + arm);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.restore();

      /* a few comets cross in front of the galaxy */
      for (const m of comets) if (m.front) drawComet(m);
    }

    function spawnComet() {
      const fromLeft = Math.random() < 0.5;
      const sp = 0.2 + Math.random() * 0.25; // pixels per millisecond
      const th = fromLeft ? 0.45 + Math.random() * 0.65 : Math.PI - 0.45 - Math.random() * 0.65;
      comets.push({
        x: fromLeft ? -30 + Math.random() * width * 0.45 : width * (0.55 + Math.random() * 0.5),
        y: -30 - Math.random() * 40,
        vx: Math.cos(th) * sp,
        vy: Math.sin(th) * sp,
        len: 120 + Math.random() * 190,
        size: 1.2 + Math.random() * 1.4,
        front: Math.random() < 0.3,
        rgb: Math.random() < 0.25 ? "255,214,150" : "190,228,255",
      });
    }

    let lastW = 0;
    let lastH = 0;
    let resizeTimer = 0;
    let pausedUntil = 0;
    let interactionTimer = 0;
    function resize() {
      if (!canvas) return;
      window.clearTimeout(resizeTimer);
      if (performance.now() < pausedUntil) {
        resizeTimer = window.setTimeout(resize, 400);
        return;
      }
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      const pixelBudget = hero ? 400_000 : 900_000;
      const dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.25,
        Math.sqrt(pixelBudget / (width * height)));
      curDpr = dpr;
      lastW = width;
      lastH = height;
      adaptTick = -30; // ignore the slow frames right after a rebuild
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      bakeBackground(dpr);
      bakeRings(dpr);
      bakePlanet(dpr);
      draw(time);
    }

    function tick(now: number) {
      const frameMs = fps60 ? 1000 / 60 : 1000 / 30;
      if (now - last >= frameMs - 4) {
        const dt = last ? Math.min(now - last, 100) : 0;
        last = now;
        time += dt;
        angle += dt * 0.00007;
        // ease toward the pointer independent of the frame rate
        const ease = 1 - Math.pow(0.95, dt / 33.3);
        driftX += (pointerX - driftX) * ease;
        driftY += (pointerY - driftY) * ease;

        for (const m of comets) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
        }
        comets = comets.filter(
          (m) => m.y < height + m.len + 40 && m.x > -m.len - 60 && m.x < width + m.len + 60,
        );
        if (time > nextComet && comets.length < 3) {
          spawnComet();
          nextComet = time + 3500 + Math.random() * 6500;
        }
        const t0 = performance.now();
        draw(time);
        frameCost += (performance.now() - t0 - frameCost) * 0.12;
        // adapt: drop specks when frames get expensive, bring them back slowly when there is headroom
        if (++adaptTick >= 20) {
          adaptTick = 0;
          if (frameCost > 14 && quality > 0.34) quality = Math.max(0.34, quality - 0.16);
          else if (frameCost < 7 && quality < 1) quality = Math.min(1, quality + 0.06);
          if (!fps60 && frameCost < 4.5 && quality >= 1) fps60 = true;
          else if (fps60 && frameCost > 8) fps60 = false;
        }
      }
      frame = requestAnimationFrame(tick);
    }

    let onScreen = true;
    function activity() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (document.hidden || !onScreen || performance.now() < pausedUntil) return;
      if (mode === "animated" && !motion.matches)
        frame = requestAnimationFrame(tick);
      else draw(0);
    }

    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
    };

    const pauseForInteraction = () => {
      pausedUntil = performance.now() + 350;
      cancelAnimationFrame(frame);
      window.clearTimeout(interactionTimer);
      interactionTimer = window.setTimeout(activity, 370);
    };

    const onResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!lastW) return resize();
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      window.clearTimeout(resizeTimer); // rebuilding every texture is costly: wait until resizing settles
      resizeTimer = window.setTimeout(resize, 160);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(canvas);
    const io =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver((entries) => {
            const vis = entries[entries.length - 1]?.isIntersecting ?? true;
            if (vis !== onScreen) {
              onScreen = vis;
              activity();
            }
          })
        : null;
    io?.observe(canvas);
    window.addEventListener("pointermove", pointer, { passive: true });
    window.addEventListener("pointerdown", pauseForInteraction, { passive: true });
    window.addEventListener("keydown", pauseForInteraction);
    window.addEventListener("scroll", pauseForInteraction, { passive: true, capture: true });
    document.addEventListener("visibilitychange", activity);
    motion.addEventListener("change", activity);
    resize();
    activity();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearTimeout(resizeTimer);
      window.clearTimeout(interactionTimer);
      io?.disconnect();
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("pointerdown", pauseForInteraction);
      window.removeEventListener("keydown", pauseForInteraction);
      window.removeEventListener("scroll", pauseForInteraction, true);
      document.removeEventListener("visibilitychange", activity);
      motion.removeEventListener("change", activity);
    };
  }, [mode, hero]);

  return <canvas ref={canvasRef} />;
}

export function WorkspaceGalaxy() {
  const mode = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "animated" as Mode,
  );
  return (
    <div className="workspace-galaxy" aria-hidden="true">
      <GalaxyCanvas mode={mode} hero />
    </div>
  );
}

/* ---------- Preview only: gives the artifact viewer a default export + minimal CSS.
   In your Next.js project you can delete this block and keep using your own globals.css. ---------- */
export default function GalaxyPreview() {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#030814", overflow: "hidden" }}>
      <style>{`
        .galaxy-backdrop, .workspace-galaxy { position: fixed; inset: 0; pointer-events: none; }
        .galaxy-backdrop canvas, .workspace-galaxy canvas { width: 100%; height: 100%; display: block; }
        .galaxy-off { display: none; }
        .galaxy-control {
          position: fixed; right: 16px; bottom: 16px; z-index: 5;
          padding: 8px 14px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(110,224,255,0.4); color: #cdefff;
          background: rgba(8,24,56,0.7); backdrop-filter: blur(6px); font: 13px system-ui, sans-serif;
        }
        .galaxy-control:hover { background: rgba(16,48,100,0.8); }
      `}</style>
      <GalaxyBackdrop />
    </div>
  );
}
