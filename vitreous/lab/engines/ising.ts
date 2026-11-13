import { hexToRgb, mulberry32, samplePal, writePx, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

const W = 132;
const H = 132;

export function createIsing(seed: number): Engine {
  const n = W * H;
  const spins = new Int8Array(n);
  const tint = new Uint8Array(n);
  let rng = mulberry32(seed);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let colors: RGB[] = [];
  let params = { temp: 2.27, field: 0, anisotropy: 1, speed: 0.4 };
  let pointer: PointerState = { u: 0, v: 0, down: false, dx: 0, dy: 0 };
  let alive = true;

  function init(s: number) {
    rng = mulberry32(s);
    for (let i = 0; i < n; i++) {
      spins[i] = rng() > 0.5 ? 1 : -1;
      tint[i] = (rng() * 255) | 0;
    }
  }

  function flips(count: number) {
    const T = Math.max(0.05, params.temp);
    const Jx = params.anisotropy;
    const Jy = 1 / Math.max(0.2, params.anisotropy);
    const h = params.field;
    for (let k = 0; k < count; k++) {
      const x = (rng() * W) | 0;
      const y = (rng() * H) | 0;
      const id = y * W + x;
      const s = spins[id]!;
      const sum =
        Jx * (spins[y * W + ((x - 1 + W) % W)]! + spins[y * W + ((x + 1) % W)]!) +
        Jy * (spins[((y - 1 + H) % H) * W + x]! + spins[((y + 1) % H) * W + x]!);
      const dE = 2 * s * (sum + h);
      if (dE <= 0 || rng() < Math.exp(-dE / T)) spins[id] = -s as 1 | -1;
    }
  }

  function stamp() {
    if (!pointer.down) return;
    const cx = pointer.u * W;
    const cy = pointer.v * H;
    const sign: 1 | -1 = pointer.u + pointer.v > 1 ? -1 : 1;
    for (let j = -7; j <= 7; j++) {
      for (let i = -7; i <= 7; i++) {
        if (i * i + j * j > 46) continue;
        const x = Math.round(cx + i);
        const y = Math.round(cy + j);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        spins[y * W + x] = sign;
      }
    }
  }

  function paint() {
    if (!ctx || !canvas || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
    const d = img.data;
    const mortar = samplePal(colors, 0.96);
    for (let y = 0; y < h; y++) {
      const gyf = (y / h) * H;
      const gy = Math.min(H - 1, gyf | 0);
      const fy = gyf - gy;
      for (let x = 0; x < w; x++) {
        const gxf = (x / w) * W;
        const gx = Math.min(W - 1, gxf | 0);
        const fx = gxf - gx;
        const id = gy * W + gx;
        const s = spins[id]!;
        const left = spins[gy * W + ((gx - 1 + W) % W)]!;
        const up = spins[((gy - 1 + H) % H) * W + gx]!;
        const edge = (fx < 0.16 && left !== s) || (fy < 0.16 && up !== s);
        if (edge) {
          writePx(d, (y * w + x) * 4, mortar);
          continue;
        }
        const base = s > 0 ? 0.16 : 0.58;
        const col = samplePal(colors, base + (tint[id]! / 255) * 0.2);
        const shade = fx > 0.72 || fy > 0.72 ? 0.72 : 1;
        writePx(d, (y * w + x) * 4, [col[0] * shade, col[1] * shade, col[2] * shade]);
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
        temp: p.temp ?? 2.27,
        field: p.field ?? 0,
        anisotropy: p.anisotropy ?? 1,
        speed: p.speed ?? 0.4,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) { pointer = s; },
    frame(_p, dt) {
      if (!alive) return;
      stamp();
      if (dt > 0) flips(Math.max(1, Math.floor(n * params.speed)));
      paint();
    },
    reset() {
      init(seed);
      flips(n * 8);
    },
    destroy() { alive = false; ctx = null; },
  };
}
