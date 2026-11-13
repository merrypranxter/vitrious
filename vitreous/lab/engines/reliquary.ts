import { hexToRgb, mulberry32, samplePal, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

export function createReliquary(seed: number): Engine {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let colors: RGB[] = [];
  let params = { freq: 2.8, warp: 1.05, thresh: 0.22, axis: 0, octaves: 5 };
  let pointer: PointerState = { u: 0, v: 0, down: false, dx: 0, dy: 0 };
  let shiftX = 0;
  let shiftY = 0;
  let alive = true;
  const perm = new Uint8Array(512);
  const rnd = mulberry32(seed || 1);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = base[i]!;
    base[i] = base[j]!;
    base[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]!;

  function noise(x: number, y: number) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const h = (ix: number, iy: number) => perm[(ix & 255) + perm[iy & 255]!]! / 255;
    const a = h(x0, y0);
    const b = h(x0 + 1, y0);
    const c = h(x0, y0 + 1);
    const d = h(x0 + 1, y0 + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  function fbm(x: number, y: number, oct: number) {
    let a = 0;
    let m = 1;
    let s = 0;
    let fx = x;
    let fy = y;
    for (let i = 0; i < oct; i++) {
      a += noise(fx, fy) * m;
      s += m;
      m *= 0.5;
      fx = fx * 2 + 9;
      fy = fy * 2 + 3;
    }
    return a / s;
  }

  function sortSpan(val: Float32Array, col: Uint8Array, start: number, end: number, stride: number) {
    const len = Math.max(0, Math.round((end - start) / stride));
    if (len < 3) return;
    const idx = new Uint16Array(len);
    for (let i = 0; i < len; i++) idx[i] = i;
    const at = (i: number) => val[start + i * stride]!;
    idx.sort((a, b) => at(a) - at(b));
    const tv = new Float32Array(len);
    const tc = new Uint8Array(len * 3);
    for (let i = 0; i < len; i++) {
      const src = start + idx[i]! * stride;
      tv[i] = val[src]!;
      const csrc = src * 3;
      const cd = i * 3;
      tc[cd] = col[csrc]!;
      tc[cd + 1] = col[csrc + 1]!;
      tc[cd + 2] = col[csrc + 2]!;
    }
    for (let i = 0; i < len; i++) {
      const dst = start + i * stride;
      val[dst] = tv[i]!;
      const cd = dst * 3;
      const cs = i * 3;
      col[cd] = tc[cs]!;
      col[cd + 1] = tc[cs + 1]!;
      col[cd + 2] = tc[cs + 2]!;
    }
  }

  function paint(phase: number) {
    if (!ctx || !canvas || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    if (w < 2 || h < 2) return;
    if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
    const val = new Float32Array(w * h);
    const col = new Uint8Array(w * h * 3);
    const oct = Math.max(2, Math.min(6, params.octaves | 0));
    const freq = params.freq;
    const warp = params.warp;
    const t = phase * 3.2;
    for (let y = 0; y < h; y++) {
      const v = y / h;
      for (let x = 0; x < w; x++) {
        const u = x / w;
        const n1 = fbm(u * freq + t + shiftX, v * freq + shiftY, oct);
        const n2 = fbm(u * freq + 4.2 - t * 0.7, v * freq + 2.1 + shiftY, oct);
        const qx = u * freq * 1.4 + warp * n1 * 2.2 + shiftX;
        const qy = v * freq * 1.4 + warp * n2 * 2.2 + shiftY;
        const f = fbm(qx, qy, oct);
        const id = y * w + x;
        val[id] = f;
        const rgb = samplePal(colors, Math.min(0.98, 0.08 + f * 0.9));
        col[id * 3] = (rgb[0] * 255) | 0;
        col[id * 3 + 1] = (rgb[1] * 255) | 0;
        col[id * 3 + 2] = (rgb[2] * 255) | 0;
      }
    }
    const thresh = params.thresh;
    const axis = params.axis | 0;
    const doH = axis === 0 || axis === 2;
    const doV = axis === 1 || axis === 2;
    if (doH) {
      for (let y = 0; y < h; y++) {
        const row = y * w;
        let x = 0;
        while (x < w) {
          if (val[row + x]! < thresh) { x++; continue; }
          let x2 = x;
          while (x2 < w && val[row + x2]! >= thresh) x2++;
          sortSpan(val, col, row + x, row + x2, 1);
          x = x2;
        }
      }
    }
    if (doV) {
      for (let x = 0; x < w; x++) {
        let y = 0;
        while (y < h) {
          if (val[y * w + x]! < thresh) { y++; continue; }
          let y2 = y;
          while (y2 < h && val[y2 * w + x]! >= thresh) y2++;
          sortSpan(val, col, y * w + x, y2 * w + x, w);
          y = y2;
        }
      }
    }
    const d = img.data;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const c = i * 3;
      d[o] = col[c]!;
      d[o + 1] = col[c + 1]!;
      d[o + 2] = col[c + 2]!;
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }

  return {
    periodic: true,
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
        freq: p.freq ?? 2.8,
        warp: p.warp ?? 1,
        thresh: p.thresh ?? 0.22,
        axis: p.axis ?? 0,
        octaves: p.octaves ?? 5,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) {
      pointer = s;
      if (s.down) {
        shiftX += s.dx * 2.5;
        shiftY += s.dy * 2.5;
      }
    },
    frame(phase) { if (alive) paint(phase); },
    reset() { shiftX = 0; shiftY = 0; },
    destroy() { alive = false; ctx = null; },
  };
}
