import { hexToRgb, mulberry32, samplePal, writePx, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

const N = 64;

function fft1d(re: Float32Array, im: Float32Array, n: number, stride: number, start: number, inv: boolean) {
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const a = start + i * stride;
      const b = start + j * stride;
      let tr = re[a]!; re[a] = re[b]!; re[b] = tr;
      tr = im[a]!; im[a] = im[b]!; im[b] = tr;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inv ? 2 : -2) * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wr = 1;
      let wi = 0;
      for (let j = 0; j < len / 2; j++) {
        const u = start + (i + j) * stride;
        const v = start + (i + j + len / 2) * stride;
        const vr = re[v]! * wr - im[v]! * wi;
        const vi = re[v]! * wi + im[v]! * wr;
        re[v] = re[u]! - vr;
        im[v] = im[u]! - vi;
        re[u] = re[u]! + vr;
        im[u] = im[u]! + vi;
        const nwr = wr * wlenRe - wi * wlenIm;
        wi = wr * wlenIm + wi * wlenRe;
        wr = nwr;
      }
    }
  }
  if (inv) {
    for (let i = 0; i < n; i++) {
      const id = start + i * stride;
      re[id] = re[id]! / n;
      im[id] = im[id]! / n;
    }
  }
}

function fft2(re: Float32Array, im: Float32Array, inv: boolean) {
  for (let y = 0; y < N; y++) fft1d(re, im, N, 1, y * N, inv);
  for (let x = 0; x < N; x++) fft1d(re, im, N, N, x, inv);
}

export function createSpinodal(seed: number): Engine {
  let a = new Float32Array(N * N);
  let re = new Float32Array(N * N);
  let im = new Float32Array(N * N);
  let cre = new Float32Array(N * N);
  let cim = new Float32Array(N * N);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let params = { epsilon: 1.02, mobility: 0.8, mean: 0.05, kick: 0.04 };
  let colors: RGB[] = [];
  let pointer: PointerState = { u: 0, v: 0, down: false, dx: 0, dy: 0 };
  let rng = mulberry32(seed);
  let alive = true;

  function fill(s: number) {
    rng = mulberry32(s);
    const mean = params.mean;
    for (let i = 0; i < a.length; i++) a[i] = mean + (rng() - 0.5) * 0.22;
  }

  function evolve() {
    const eps2 = params.epsilon * params.epsilon;
    const mob = params.mobility;
    const dt = 0.2 * (0.35 + mob);
    const kick = params.kick;
    const n = N * N;
    for (let i = 0; i < n; i++) {
      let c = a[i]!;
      if (kick > 0) c += (rng() - 0.5) * kick * 0.08;
      if (c > 1.4) c = 1.4;
      if (c < -1.4) c = -1.4;
      re[i] = c;
      im[i] = 0;
      cre[i] = c * c * c;
      cim[i] = 0;
    }
    fft2(re, im, false);
    fft2(cre, cim, false);
    for (let y = 0; y < N; y++) {
      const ky = y <= N / 2 ? y : y - N;
      const cy = Math.cos((2 * Math.PI * ky) / N);
      for (let x = 0; x < N; x++) {
        const kx = x <= N / 2 ? x : x - N;
        const id = y * N + x;
        const L = 2 * Math.cos((2 * Math.PI * kx) / N) + 2 * cy - 4;
        const linear = mob * L * (-1 - eps2 * L);
        const denom = 1 - dt * linear;
        re[id] = (re[id]! + dt * mob * L * cre[id]!) / denom;
        im[id] = (im[id]! + dt * mob * L * cim[id]!) / denom;
      }
    }
    re[0] = params.mean * n;
    im[0] = 0;
    fft2(re, im, true);
    for (let i = 0; i < n; i++) {
      let c = re[i]!;
      if (!Number.isFinite(c)) c = params.mean;
      if (c > 1.45) c = 1.45;
      if (c < -1.45) c = -1.45;
      a[i] = c;
    }
  }

  function splat() {
    if (!pointer.down) return;
    const cx = pointer.u * (N - 1);
    const cy = pointer.v * (N - 1);
    for (let j = -4; j <= 4; j++) {
      for (let i = -4; i <= 4; i++) {
        const x = Math.round(cx + i);
        const y = Math.round(cy + j);
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const w = Math.exp(-(i * i + j * j) / 8);
        const id = y * N + x;
        a[id] = a[id]! * (1 - w) + (a[id]! > 0 ? -1 : 1) * w;
      }
    }
  }

  function paint() {
    if (!ctx || !canvas || !img || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
    const d = img.data;
    const sample = (fx: number, fy: number) => {
      let x = ((fx % N) + N) % N;
      let y = ((fy % N) + N) % N;
      const x0 = Math.floor(x) % N;
      const y0 = Math.floor(y) % N;
      const x1 = (x0 + 1) % N;
      const y1 = (y0 + 1) % N;
      const tx = x - Math.floor(x);
      const ty = y - Math.floor(y);
      return (
        a[y0 * N + x0]! * (1 - tx) * (1 - ty) +
        a[y0 * N + x1]! * tx * (1 - ty) +
        a[y1 * N + x0]! * (1 - tx) * ty +
        a[y1 * N + x1]! * tx * ty
      );
    };
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * N;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * N;
        const c = sample(fx, fy);
        const gx = sample(fx + 1.2, fy) - sample(fx - 1.2, fy);
        const gy = sample(fx, fy + 1.2) - sample(fx, fy - 1.2);
        const nx = -gx * 5;
        const ny = -gy * 5;
        const nz = 1;
        const inv = 1 / Math.hypot(nx, ny, nz);
        const ndl = Math.max(0, nx * inv * 0.25 + ny * inv * 0.45 + nz * inv * 0.86);
        const t = 0.12 + 0.82 * (c * 0.5 + 0.5);
        const base = samplePal(colors, t);
        const edge = Math.exp(-c * c * 22);
        const hi = samplePal(colors, 0.78);
        const spec = Math.pow(ndl, 18);
        const rgb: RGB = [
          base[0] * (0.28 + 0.9 * ndl) + hi[0] * edge * 0.85 + spec * 0.7,
          base[1] * (0.28 + 0.9 * ndl) + hi[1] * edge * 0.85 + spec * 0.65,
          base[2] * (0.28 + 0.9 * ndl) + hi[2] * edge * 0.85 + spec * 0.55,
        ];
        writePx(d, (y * w + x) * 4, rgb);
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
        epsilon: p.epsilon ?? 1,
        mobility: p.mobility ?? 0.8,
        mean: p.mean ?? 0,
        kick: p.kick ?? 0,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) { pointer = s; },
    frame(_phase, dt) {
      if (!alive) return;
      splat();
      if (dt > 0) evolve();
      paint();
    },
    reset() { fill(seed); for (let i = 0; i < 36; i++) evolve(); },
    destroy() { alive = false; ctx = null; },
  };
}
