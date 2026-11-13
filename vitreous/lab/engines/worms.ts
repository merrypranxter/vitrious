import { hexToRgb, mulberry32, samplePal, writePx, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

const W = 180;
const H = 180;

type Worm = { x: number; y: number; a: number; s: number };

export function createWorms(seed: number): Engine {
  const field = new Float32Array(W * H);
  const who = new Uint8Array(W * H);
  let worms: Worm[] = [];
  let rng = mulberry32(seed);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let colors: RGB[] = [];
  let params = { population: 80, sensor: 6.5, fade: 0.01, species: 3, jitter: 0.22 };
  let pointer: PointerState = { u: 0, v: 0, down: false, dx: 0, dy: 0 };
  let alive = true;

  function at(x: number, y: number) {
    const ix = ((Math.round(x) % W) + W) % W;
    const iy = ((Math.round(y) % H) + H) % H;
    return field[iy * W + ix]!;
  }

  function spawn(s: number) {
    rng = mulberry32(s);
    field.fill(0);
    who.fill(0);
    worms = [];
    const pop = Math.max(1, params.population | 0);
    const species = Math.max(1, params.species | 0);
    for (let i = 0; i < pop; i++) {
      worms.push({
        x: rng() * W,
        y: rng() * H,
        a: rng() * Math.PI * 2,
        s: i % species,
      });
    }
  }

  function syncPop() {
    const pop = Math.max(1, params.population | 0);
    const species = Math.max(1, params.species | 0);
    while (worms.length < pop) {
      worms.push({ x: rng() * W, y: rng() * H, a: rng() * Math.PI * 2, s: worms.length % species });
    }
    if (worms.length > pop) worms.length = pop;
    for (const w of worms) w.s = w.s % species;
  }

  function step() {
    const fade = params.fade;
    for (let i = 0; i < field.length; i++) field[i] = Math.max(0, field[i]! * (1 - fade));
    const sensor = params.sensor;
    const turn = 0.55;
    const species = Math.max(1, params.species | 0);
    if (pointer.down) {
      const cx = pointer.u * W;
      const cy = pointer.v * H;
      for (let j = -14; j <= 14; j++) {
        for (let i = -14; i <= 14; i++) {
          if (i * i + j * j > 196) continue;
          const x = Math.round(cx + i);
          const y = Math.round(cy + j);
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          field[y * W + x] = 0;
        }
      }
    }
    for (const w of worms) {
      const sense = (da: number) => {
        const a = w.a + da;
        return at(w.x + Math.cos(a) * sensor, w.y + Math.sin(a) * sensor);
      };
      const c = sense(0);
      const l = sense(-0.55);
      const r = sense(0.55);
      if (l < c && l < r) w.a -= turn;
      else if (r < c && r < l) w.a += turn;
      else if (l < c && r < c) w.a += (rng() - 0.5) * 2 * (0.2 + params.jitter);
      else if (params.jitter > 0 && rng() < params.jitter * 0.15) w.a += (rng() - 0.5);
      w.x = (w.x + Math.cos(w.a) * 1.15 + W) % W;
      w.y = (w.y + Math.sin(w.a) * 1.15 + H) % H;
      const ix = (w.x | 0) % W;
      const iy = (w.y | 0) % H;
      const id = iy * W + ix;
      field[id] = 1;
      who[id] = w.s % species;
    }
  }

  function paint() {
    if (!ctx || !canvas || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
    const d = img.data;
    const species = Math.max(1, params.species | 0);
    for (let y = 0; y < h; y++) {
      const gy = Math.min(H - 1, ((y / h) * H) | 0);
      for (let x = 0; x < w; x++) {
        const gx = Math.min(W - 1, ((x / w) * W) | 0);
        const id = gy * W + gx;
        const age = field[id]!;
        const sp = who[id]! % species;
        const t = 0.12 + ((sp + 0.35) / species) * 0.78;
        const col = samplePal(colors, Math.min(0.98, t));
        const left = field[gy * W + ((gx - 1 + W) % W)]!;
        const right = field[gy * W + ((gx + 1) % W)]!;
        const up = field[((gy - 1 + H) % H) * W + gx]!;
        const dn = field[((gy + 1) % H) * W + gx]!;
        const gx1 = right - left;
        const gy1 = dn - up;
        const spec = Math.max(0, gx1 * 0.8 + gy1 * -0.45);
        const lit = 0.18 + age * 0.9 + spec * 0.8;
        writePx(d, (y * w + x) * 4, [col[0] * lit, col[1] * lit, col[2] * lit]);
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  return {
    periodic: false,
    mount(c) {
      canvas = c;
      const g = c.getContext("2d", { alpha: false, willReadFrequently: true });
      if (!g) throw new Error("Could not draw this material.");
      ctx = g;
    },
    setBitmap(w, h) {
      if (!canvas || !ctx) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        img = ctx.createImageData(w, h);
      }
    },
    setParams(p) {
      params = {
        population: p.population ?? 80,
        sensor: p.sensor ?? 6.5,
        fade: p.fade ?? 0.01,
        species: p.species ?? 3,
        jitter: p.jitter ?? 0.2,
      };
      if (worms.length) syncPop();
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) { pointer = s; },
    frame(_p, dt) {
      if (!alive) return;
      if (dt > 0) {
        step();
        if (dt > 0.02) step();
      }
      paint();
    },
    reset() {
      spawn(seed);
      for (let i = 0; i < 180; i++) step();
    },
    destroy() { alive = false; ctx = null; },
  };
}
