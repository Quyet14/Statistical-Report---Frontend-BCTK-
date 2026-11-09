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
  [0.22, 0.63, 0.2, 0.9, 1], // smooth glowing inner disc: only a few fine specks
  [0.65, 0.99, 1.7, 0.9, 3], // dark lined rings: many tiny bright specks
  [1.0, 1.04, 0.15, 1.0, 2], // thin glowing ring
  [1.08, 1.22, 1.0, 0.6, 4], // grainy outer belt
];
const BAND_TOTAL = BANDS.reduce((s, b) => s + b[2], 0);

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
    const r = band[0] + rnd(i * 5.3 + 1) * (band[1] - band[0]);
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
    const r = 0.3 + Math.pow(rnd(k * 3.3), 1.4) * 1.2;
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
  for (let i = 0; i < 3000; i++) {
    const k = i + 20000;
    const r = 1.12 + Math.pow(rnd(k * 2.3), 1.7) * 0.3;
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
  return list;
}

/* Dust plumes streaming away from the disc along its minor axis */
type Plume = { u: number; dir: number; p0: number; size: number; kind: number; tw: number; speed: number };
function makePlumes(count: number): Plume[] {
  return Array.from({ length: count }, (_, i) => {
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
      trail: rnd(i * 2.9 + 8) < 0.2,
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
  { x0: 0.16, y0: 0.2, r: 19, vx: 3.4, vy: 0.9, kind: "gas", c: ["#f6dcae", "#c98a4b", "#5e3418"], glow: "255,190,120" },
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

    const particles = makeParticles(hero ? 3200 : 4000, hero ? 500 : 700);
    const plumes = makePlumes(hero ? 1500 : 2400);
    const infall = makeInfall(hero ? 650 : 950);
    const im = infall.length;
    const ix = new Float32Array(im);
    const iy = new Float32Array(im);
    const itx = new Float32Array(im);
    const ity = new Float32Array(im);
    const isz = new Float32Array(im);
    const ial = new Float32Array(im);
    const ids = new Float32Array(im);
    const glint = particles.map((p, i) => !p.dust && (p.kind === 1 || p.kind === 3) && i % 61 === 0);
    const stars = makeStars(170);
    const n = particles.length;
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const ss = new Float32Array(n);
    const al = new Float32Array(n);
    const ds = new Float32Array(n);
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
      const lx = -0.45;
      const ly = -0.55;
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
            pShade[i] = (0.24 + 0.98 * Math.pow(diffuse, 0.72)) * (0.92 + 0.08 * nz);
            const lit = (nx * Lx + ny * Ly) * 0.5 + 0.5;
            pRim[i] = Math.pow(1 - nz, 3.2) * (0.15 + 0.85 * Math.min(1, Math.max(0, lit)));
            pLon[i] = Math.atan2(nx, nz);
            const lat = Math.asin(Math.max(-1, Math.min(1, ny)));
            pRow[i] = Math.floor((lat / Math.PI + 0.5) * (TEX_H - 1)) * TEX_W;
            pPole[i] = Math.abs(lat) / (Math.PI / 2);
            pRingBand[i] = smooth(0, 1, 1 - Math.abs(lat - 0.36) / 0.2);
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
        const oR = 14 + 10 * mo + 40 * shallow;
        const oG = 82 + 24 * mo + 95 * shallow;
        const oB = 176 + 30 * mo + 50 * shallow;

        // land: muted greens, tans, rock and snow
        const t = Math.max(0, (h - EARTH_SEA) / (1 - EARTH_SEA));
        const arid = Math.max(0, 1 - Math.abs(pole - 0.28) / 0.15) * 0.35;
        const green = smooth(0.3, 0.55, mo - arid);
        let lr = 192 + (74 - 192) * green;
        let lg = 162 + (140 - 162) * green;
        let lb = 112 + (62 - 112) * green;
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
        const shadow = (1 - 0.38 * cshadow * (1 - cv)) * (1 - 0.26 * pRingBand[i]); // cloud + ring shadows
        let sr = r * sh * shadow;
        let sg = gg * sh * shadow;
        let sb = b * sh * shadow;
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
        sr = (lum + (sr - lum) * 1.1) * 1.12;
        sg = (lum + (sg - lum) * 1.1) * 1.12;
        sb = (lum + (sb - lum) * 1.1) * 1.12;
        const haze = pRim[i] * 1.35; // thin atmosphere on the lit limb
        data[o] = Math.min(255, sr + 84 * haze);
        data[o + 1] = Math.min(255, sg + 150 * haze);
        data[o + 2] = Math.min(255, sb + 255 * haze);
        data[o + 3] = pAlpha[i] * 255;
      }
      pCtx.putImageData(pImg, 0, 0);
    }

    const ringTex: (HTMLCanvasElement | null)[] = [null, null, null];
    let texHalf = 0;

    function bakeRings(dpr: number) {
      const R = layout().radius;
      const k = Math.min(dpr, 1.25);
      texHalf = R * 1.4;
      const size = Math.ceil(texHalf * 2 * k);
      // zone 0: smooth glowing disc · zone 1: dark lined rings + glowing line · zone 2: grainy belt
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
        // 1-D value noise (not periodic in practice) used to make gaps and lanes irregular
        const n1 = (x: number) => vnoise(x, 0.5, 1e6);
        // organic density profile: 0 = dark gap, 1 = dense lane
        const prof = (r: number) => {
          const v = 0.55 * n1(r * 70 + zi * 13.7) + 0.3 * n1(r * 190 + 17.3) + 0.15 * n1(r * 420 + 5.1);
          return Math.min(1, Math.max(0, (v - 0.27) * 2.3));
        };
        const softStreak = (r: number, a0: number, len: number, w: number, rgb: string, al: number) => {
          streak(r, a0, len, w * 3.2, rgb, al * 0.22);
          streak(r, a0, len, w, rgb, al);
        };
        // a streak that fades out at both ends: three nested arcs, longest faintest
        const streak = (r: number, a0: number, len: number, w: number, rgb: string, al: number) => {
          for (let k = 0; k < 3; k++) {
            const f = 1 - k * 0.32;
            const off = (len * (1 - f)) / 2;
            c.strokeStyle = `rgba(${rgb},${al * (0.35 + k * 0.33)})`;
            c.lineWidth = w * (0.7 + k * 0.2);
            arc(r, a0 + off, len * f);
          }
        };

        if (zi === 0) {
          // smooth, silky bands: cyan glow against the planet, then azure / royal blue / light blue
          ringGradient(0.2, 0.64, [
            [0, "rgba(170,236,255,0.96)"],
            [0.09, "rgba(75,190,255,0.96)"],
            [0.22, "rgba(55,160,255,0.96)"],
            [0.34, "rgba(24,98,238,0.96)"],
            [0.46, "rgba(70,170,255,0.97)"],
            [0.56, "rgba(105,205,255,0.97)"],
            [0.68, "rgba(20,84,225,0.96)"],
            [0.8, "rgba(40,135,250,0.96)"],
            [0.92, "rgba(12,58,190,0.95)"],
            [1, "rgba(8,40,150,0.94)"],
          ]);
          // thin soft lines where one band meets the next: a dark edge with a pale edge beside it
          for (const rr of [0.285, 0.375, 0.465, 0.555]) {
            ringGradient(rr - 0.045, rr, [
              [0, "rgba(4,22,105,0)"],
              [1, "rgba(4,22,105,0.55)"],
            ]);
            ringGradient(rr, rr + 0.03, [
              [0, "rgba(170,228,255,0.38)"],
              [1, "rgba(120,200,255,0)"],
            ]);
            c.strokeStyle = "rgba(215,244,255,0.75)";
            c.lineWidth = Math.max(0.7, R * 0.0032);
            arc(rr + 0.002, 0, TAU);
          }
          // a few broad, uneven smudges so the bands are not perfectly uniform
          for (let q = 0; q < 26; q++) {
            const h = seed + q * 5.3;
            const r = 0.22 + rnd(h + 1) * 0.4;
            const bright = rnd(h + 2) < 0.5;
            streak(r, rnd(h + 3) * TAU, 0.8 + rnd(h + 4) * 2.2, R * (0.018 + rnd(h + 5) * 0.03), bright ? "150,220,255" : "8,40,150", bright ? 0.1 : 0.14);
          }
          c.globalCompositeOperation = "lighter";
          // a handful of long, smooth white swooshes lying along the bands
          for (let q = 0; q < 16; q++) {
            const h = seed + 3000 + q * 4.1;
            const r = 0.24 + rnd(h + 1) * 0.38;
            softStreak(r, rnd(h + 2) * TAU, 0.7 + rnd(h + 3) * 1.9, R * (0.0025 + rnd(h + 4) * 0.005), rnd(h + 5) < 0.6 ? "235,250,255" : "140,220,255", 0.45 + rnd(h + 6) * 0.45);
          }
          c.globalCompositeOperation = "source-over";
        } else if (zi === 1) {
          // dark base
          ringGradient(0.64, 1.08, [
            [0, "rgba(8,34,130,0.9)"],
            [0.05, "rgba(2,8,30,0.97)"],
            [1, "rgba(1,4,14,0.97)"],
          ]);
          // two smooth luminous blue bands, with a pale line along each edge
          const glowBand = (r0: number, r1: number, core: string, edge: string) =>
            ringGradient(r0, r1, [
              [0, "rgba(8,40,160,0)"],
              [0.18, edge],
              [0.5, core],
              [0.82, edge],
              [1, "rgba(8,40,160,0)"],
            ]);
          glowBand(0.712, 0.805, "rgba(85,198,255,0.97)", "rgba(30,112,245,0.8)");
          glowBand(0.912, 1.0, "rgba(70,188,255,0.98)", "rgba(25,100,240,0.8)");
          c.strokeStyle = "rgba(225,245,255,0.8)";
          c.lineWidth = Math.max(0.8, R * 0.004);
          arc(0.722, 0, TAU);
          c.strokeStyle = "rgba(205,238,255,0.6)";
          arc(0.797, 0, TAU);
          // uneven dark smudges across the bright bands (soft, wide)
          for (let q = 0; q < 34; q++) {
            const h = seed + 200 + q * 5.1;
            const inBand = rnd(h + 1) < 0.5 ? 0.715 + rnd(h + 2) * 0.085 : 0.915 + rnd(h + 2) * 0.085;
            streak(inBand, rnd(h + 3) * TAU, 0.5 + rnd(h + 4) * 1.8, R * (0.008 + rnd(h + 5) * 0.014), "4,22,100", 0.25 + rnd(h + 6) * 0.2);
          }
          // radius picker: mostly the dark ring and the dark inner strip, a little everywhere
          const pickR = (h: number) => {
            const k = rnd(h);
            if (k < 0.62) return 0.815 + rnd(h + 1) * 0.095; // dark stippled ring
            if (k < 0.82) return 0.645 + rnd(h + 1) * 0.07; // dark inner strip
            if (k < 0.9) return 1.005 + rnd(h + 1) * 0.07; // dark outer strip
            if (k < 0.95) return 0.715 + rnd(h + 1) * 0.09; // fine lines inside the first bright band
            return 0.915 + rnd(h + 1) * 0.085; // ... and inside the second
          };
          // dark specks first (so they punch holes in the bright bands too)
          for (let q = 0; q < 5500; q++) {
            const h = seed + 30000 + q * 2.9;
            speck(pickR(h), rnd(h + 3) * TAU, Math.max(0.8, R * (0.003 + rnd(h + 4) * 0.005)), `rgba(1,4,14,${0.6 + rnd(h + 5) * 0.4})`);
          }
          c.globalCompositeOperation = "lighter";
          // fine concentric arcs, white / cyan / blue, short and long, thin
          for (let q = 0; q < 520; q++) {
            const h = seed + 1000 + q * 4.37;
            const k = rnd(h + 3);
            const rgb = k < 0.26 ? "238,248,255" : k < 0.58 ? "115,205,255" : "40,125,245";
            const w = Math.max(0.55, R * (0.0012 + Math.pow(rnd(h + 2), 2) * 0.0035));
            streak(pickR(h), rnd(h + 5) * TAU, 0.08 + Math.pow(rnd(h + 6), 1.5) * 1.8, w, rgb, 0.3 + rnd(h + 4) * 0.65);
          }
          // salt-and-pepper grain: white, cyan and blue specks
          for (let q = 0; q < 6500; q++) {
            const h = seed + 20000 + q * 3.17;
            const w = rnd(h + 6);
            const al = 0.5 + rnd(h + 7) * 0.5;
            const col =
              w < 0.3 ? `rgba(238,248,255,${al})` : w < 0.6 ? `rgba(125,205,255,${al})` : `rgba(55,125,238,${al})`;
            speck(pickR(h), rnd(h + 4) * TAU, Math.max(0.7, R * (0.0022 + rnd(h + 5) * 0.0035)), col);
          }
          // the thin glowing rim just outside the second bright band; thickness and brightness drift around it
          const steps = 150;
          for (let q = 0; q < steps; q++) {
            const a0 = (q / steps) * TAU;
            const br = 0.45 + 0.55 * n1(a0 * 2.6 + 9.3);
            const wob = (n1(a0 * 5 + 2.2) - 0.5) * 0.01;
            const piece = (TAU / steps) * 1.35;
            c.strokeStyle = `rgba(35,130,255,${0.1 + 0.18 * br})`;
            c.lineWidth = R * (0.04 + 0.04 * br);
            arc(1.015 + wob, a0, piece);
            c.strokeStyle = `rgba(230,247,255,${0.4 + 0.55 * br})`;
            c.lineWidth = Math.max(0.8, R * (0.003 + 0.006 * br));
            arc(1.012 + wob, a0, piece);
          }
          c.globalCompositeOperation = "source-over";
        } else {
          // deep blue grainy belt that fades into space
          ringGradient(1.08, 1.26, [
            [0, "rgba(10,50,170,0.92)"],
            [0.3, "rgba(18,80,215,0.88)"],
            [0.7, "rgba(10,45,160,0.6)"],
            [1, "rgba(5,25,100,0)"],
          ]);
          for (let q = 0; q < 9000; q++) {
            const h = seed + q * 2.71;
            const r = 1.08 + Math.pow(rnd(h + 1), 0.95) * 0.18;
            if (rnd(h + 8) < ((r - 1.08) / 0.18) * 0.6) continue;
            const w = rnd(h + 4);
            const al = 0.6 + rnd(h + 5) * 0.35;
            const col =
              w < 0.4
                ? `rgba(22,75,205,${al})`
                : w < 0.72
                  ? `rgba(55,135,255,${al})`
                  : w < 0.82
                    ? `rgba(235,246,255,${al})`
                    : `rgba(2,6,24,${al})`;
            speck(r, rnd(h + 2) * TAU, R * (0.003 + rnd(h + 3) * 0.007), col);
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

      /* project every particle once per frame */
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        const a = p.phase + angle * p.speed;
        const depth = Math.sin(a);
        const persp = 2.8 / (2.8 - depth * 0.55);
        const tw = 0.7 + 0.3 * Math.sin(t * 0.004 + p.tw);
        xs[i] = Math.cos(a) * p.r * radius * persp;
        ys[i] = (depth * p.r * tilt + p.z) * radius * persp;
        ss[i] = p.size * persp * sizeK;
        ds[i] = depth;
        al[i] = p.kind === 4 ? 0.85 : Math.min(1, (p.dust ? 0.5 : 0.62 + (1 - Math.abs(depth)) * 0.3) * tw);
      }

      /* infalling dust and stars: far out, they spiral toward the rings, speed up, then fade */
      for (let i = 0; i < im; i++) {
        const p = infall[i];
        const f = (p.p0 + t * 0.000011 * p.speed) % 1;
        const rr = p.rIn + (p.rOut - p.rIn) * (1 - f * f);
        const a = p.phase + p.spin * f + (angle * 0.6) / Math.pow(rr, 1.5);
        const depth = Math.sin(a);
        const persp = 2.8 / (2.8 - depth * 0.55);
        ix[i] = Math.cos(a) * rr * radius * persp;
        iy[i] = (depth * rr * tilt + p.z * rr) * radius * persp;
        const f2 = Math.max(0, f - 0.012);
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
      halo.addColorStop(0, "rgba(40,150,255,0.38)");
      halo.addColorStop(0.3, "rgba(20,100,255,0.2)");
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
        g.globalAlpha = front ? 1 : 0.78;
        for (let z = 0; z < 3; z++) {
          const tex = ringTex[z];
          if (!tex) continue;
          g.save();
          g.rotate(angle * ZONE_SPIN[z]);
          g.drawImage(tex, -texHalf, -texHalf, texHalf * 2, texHalf * 2);
          g.restore();
        }
        g.globalAlpha = 1;
        // light falls on the inner disc from the lit side: a soft bright lobe facing the light
        if (typeof g.createConicGradient === "function") {
          g.save();
          g.globalCompositeOperation = "lighter";
          const lit = g.createConicGradient(0, 0, 0);
          for (let k = 0; k <= 36; k++) {
            const a = (k / 36) * TAU;
            const lobe = Math.pow(Math.max(0, Math.cos(a + 1.33)), 3);
            lit.addColorStop(k / 36, `rgba(120,205,255,${(0.02 + 0.2 * lobe).toFixed(3)})`);
          }
          g.strokeStyle = lit;
          g.lineWidth = radius * 0.44;
          g.beginPath();
          g.arc(0, 0, radius * 0.42, 0, TAU);
          g.stroke();
          g.restore();
        }
        // shadow cast by the planet across the rings, pointing away from the light
        g.save();
        g.rotate(1.81);
        const shLen = radius * 1.5;
        const shW = core * 0.95;
        for (let k = 0; k < 10; k++) {
          const a = 0.62 * Math.pow(1 - k / 10, 0.8);
          const sg = g.createLinearGradient(0, -shW * 1.25, 0, shW * 1.25);
          sg.addColorStop(0, "rgba(1,4,16,0)");
          sg.addColorStop(0.22, `rgba(1,4,16,${a})`);
          sg.addColorStop(0.78, `rgba(1,4,16,${a})`);
          sg.addColorStop(1, "rgba(1,4,16,0)");
          g.fillStyle = sg;
          g.fillRect((k / 10) * shLen, -shW * 1.25, shLen / 10 + 1, shW * 2.5);
        }
        g.restore();
        // lighting: the far side of the disc falls into shade
        if (typeof g.createConicGradient === "function") {
          const cg = g.createConicGradient(0, 0, 0);
          for (let k = 0; k <= 24; k++) {
            const a = (k / 24) * TAU;
            const dark = Math.pow(Math.max(0, Math.cos(a - 1.81)), 1.5) * 0.46;
            cg.addColorStop(k / 24, `rgba(2,6,22,${dark})`);
          }
          g.strokeStyle = cg;
          g.lineWidth = radius * 1.12;
          g.beginPath();
          g.arc(0, 0, radius * 0.74, 0, TAU);
          g.stroke();
        }
        g.restore();
        g.restore();
      }

      function particlePass(front: boolean, dark: boolean) {
        g.save();
        g.globalCompositeOperation = dark ? "source-over" : "lighter";
        for (let i = 0; i < n; i++) {
          if (ds[i] > 0 !== front) continue;
          const isDark = particles[i].kind === 4;
          if (isDark !== dark) continue;
          g.globalAlpha = al[i];
          g.fillStyle = COLORS[particles[i].kind];
          dot(xs[i], ys[i], ss[i]);
          if (glint[i]) {
            const gl = Math.pow(Math.max(0, Math.sin(t * 0.003 + particles[i].tw)), 6);
            if (gl > 0.05) {
              const rr = (ss[i] * 2 + 2.5) * (0.6 + gl);
              const bloom = g.createRadialGradient(xs[i], ys[i], 0, xs[i], ys[i], rr);
              bloom.addColorStop(0, "rgba(225,245,255,0.9)");
              bloom.addColorStop(1, "rgba(120,190,255,0)");
              g.globalAlpha = gl * 0.8;
              g.fillStyle = bloom;
              g.fillRect(xs[i] - rr, ys[i] - rr, rr * 2, rr * 2);
            }
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
            g.globalAlpha = al * 0.4;
            g.beginPath();
            g.moveTo(itx[i], ity[i]);
            g.lineTo(ix[i], iy[i]);
            g.stroke();
          }
          g.globalAlpha = al;
          dot(ix[i], iy[i], isz[i]);
          if (p.big) {
            const rr = isz[i] * 3 + 5;
            const bl = g.createRadialGradient(ix[i], iy[i], 0, ix[i], iy[i], rr);
            bl.addColorStop(0, "rgba(225,245,255,0.85)");
            bl.addColorStop(1, "rgba(120,190,255,0)");
            g.globalAlpha = al * 0.8;
            g.fillStyle = bl;
            g.fillRect(ix[i] - rr, iy[i] - rr, rr * 2, rr * 2);
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
      plate.addColorStop(0, "rgba(90,210,255,0.62)");
      plate.addColorStop(0.6, "rgba(35,135,255,0.32)");
      plate.addColorStop(1, "rgba(20,90,255,0)");
      g.fillStyle = plate;
      g.beginPath();
      g.arc(0, 0, radius * 0.62, 0, TAU);
      g.fill();
      g.restore();

      drawRingLayer(true);

      /* ---------- planet: lit, slowly rotating sphere ---------- */
      g.save();
      g.rotate(-TILT_ANGLE); // upright so light always comes from the upper-left

      g.globalCompositeOperation = "lighter";
      const glow = g.createRadialGradient(0, 0, core * 0.8, 0, 0, core * 3.2);
      glow.addColorStop(0, "rgba(40,150,255,0.26)");
      glow.addColorStop(0.4, "rgba(20,90,255,0.1)");
      glow.addColorStop(1, "rgba(10,50,190,0)");
      g.fillStyle = glow;
      g.fillRect(-core * 3.4, -core * 3.4, core * 6.8, core * 6.8);
      g.globalCompositeOperation = "source-over";

      renderPlanet(angle * 0.35);
      if (pCanvas) g.drawImage(pCanvas, -pS / (2 * pK), -pS / (2 * pK), pS / pK, pS / pK);
      g.restore();

      particlePass(true, false);
      particlePass(true, true);
      infallPass(true);

      /* dust plumes flowing outward along the minor axis (orange / yellow / white specks) */
      g.globalCompositeOperation = "lighter";
      for (const p of plumes) {
        const f = (p.p0 + t * 0.000018 * p.speed) % 1;
        const fade = Math.sin(f * Math.PI);
        if (fade <= 0.02) continue;
        const x = p.u * (0.7 + f) * radius + Math.sin(t * 0.0012 + p.tw) * radius * 0.015;
        const y = p.dir * (0.45 + f * 1.25) * radius;
        g.globalAlpha = fade * (0.55 + 0.4 * Math.sin(t * 0.004 + p.tw));
        g.fillStyle = COLORS[p.kind];
        dot(x, y, p.size * (1.25 - f * 0.4) * sizeK);
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

    function resize() {
      if (!canvas) return;
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      bakeBackground(dpr);
      bakeRings(dpr);
      bakePlanet(dpr);
      draw(time);
    }

    function tick(now: number) {
      if (now - last >= 1000 / 30) {
        const dt = last ? Math.min(now - last, 100) : 0;
        last = now;
        time += dt;
        angle += dt * 0.00007;
        driftX += (pointerX - driftX) * 0.05;
        driftY += (pointerY - driftY) * 0.05;

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
        draw(time);
      }
      frame = requestAnimationFrame(tick);
    }

    function activity() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      if (document.hidden) return;
      if (mode === "animated" && !motion.matches)
        frame = requestAnimationFrame(tick);
      else draw(0);
    }

    const pointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      pointerX = event.clientX / window.innerWidth - 0.5;
      pointerY = event.clientY / window.innerHeight - 0.5;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener("pointermove", pointer, { passive: true });
    document.addEventListener("visibilitychange", activity);
    motion.addEventListener("change", activity);
    resize();
    activity();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", pointer);
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