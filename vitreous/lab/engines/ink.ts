import { hexToRgb, writePx, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

const N = 88;

export function createInk(seed: number): Engine {
  const n = N * N;
  let vx = new Float32Array(n);
  let vy = new Float32Array(n);
  let vx0 = new Float32Array(n);
  let vy0 = new Float32Array(n);
  let cr = new Float32Array(n);
  let cg = new Float32Array(n);
  let cb = new Float32Array(n);
  let cr0 = new Float32Array(n);
  let cg0 = new Float32Array(n);
  let cb0 = new Float32Array(n);
  const div = new Float32Array(n);
  const pr = new Float32Array(n);
  const curl = new Float32Array(n);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let img: ImageData | null = null;
  let colors: RGB[] = [
    [0.05, 0.04, 0.06],
    [1, 0.2, 0.4],
    [0.1, 0.9, 0.8],
    [1, 0.8, 0.2],
    [0.6, 0.4, 1],
  ];
  let params = { viscosity: 0.18, vorticity: 6, fade: 0.992, stir: 1.15 };
  let pointer: PointerState = { u: 0, v: 0, down: false, dx: 0, dy: 0 };
  let time = seed * 0.001;
  let alive = true;

  const id = (i: number, j: number) => ((i % N) + N) % N + (((j % N) + N) % N) * N;

  function advect(src: Float32Array, dst: Float32Array, dt: number) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = i + j * N;
        let x = i - dt * vx[k]! * N;
        let y = j - dt * vy[k]! * N;
        x = ((x % N) + N) % N;
        y = ((y % N) + N) % N;
        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const tx = x - x0;
        const ty = y - y0;
        const x1 = (x0 + 1) % N;
        const y1 = (y0 + 1) % N;
        const s00 = src[x0 + y0 * N]!;
        const s10 = src[x1 + y0 * N]!;
        const s01 = src[x0 + y1 * N]!;
        const s11 = src[x1 + y1 * N]!;
        dst[k] = s00 * (1 - tx) * (1 - ty) + s10 * tx * (1 - ty) + s01 * (1 - tx) * ty + s11 * tx * ty;
      }
    }
  }

  function project(ux: Float32Array, uy: Float32Array) {
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = i + j * N;
        div[k] = (-0.5 * (ux[id(i + 1, j)]! - ux[id(i - 1, j)]! + uy[id(i, j + 1)]! - uy[id(i, j - 1)]!)) / N;
        pr[k] = 0;
      }
    }
    for (let s = 0; s < 16; s++) {
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const k = i + j * N;
          pr[k] = (div[k]! + pr[id(i - 1, j)]! + pr[id(i + 1, j)]! + pr[id(i, j - 1)]! + pr[id(i, j + 1)]!) * 0.25;
        }
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = i + j * N;
        ux[k] -= 0.5 * N * (pr[id(i + 1, j)]! - pr[id(i - 1, j)]!);
        uy[k] -= 0.5 * N * (pr[id(i, j + 1)]! - pr[id(i, j - 1)]!);
      }
    }
  }

  function confine(eps: number, dt: number) {
    if (eps <= 0) return;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        curl[i + j * N] =
          0.5 * N * (vy[id(i + 1, j)]! - vy[id(i - 1, j)]! - (vx[id(i, j + 1)]! - vx[id(i, j - 1)]!));
      }
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = i + j * N;
        const dwdx = 0.5 * N * (Math.abs(curl[id(i + 1, j)]!) - Math.abs(curl[id(i - 1, j)]!));
        const dwdy = 0.5 * N * (Math.abs(curl[id(i, j + 1)]!) - Math.abs(curl[id(i, j - 1)]!));
        const len = Math.hypot(dwdx, dwdy) + 1e-5;
        const wz = curl[k]!;
        vx[k] += eps * dt * ((dwdy / len) * wz);
        vy[k] -= eps * dt * ((dwdx / len) * wz);
      }
    }
  }

  function splat(u: number, v: number, rgb: RGB, fx: number, fy: number, rad = 3.1, amt = 0.9) {
    const cx = u * (N - 1);
    const cy = v * (N - 1);
    const r0 = Math.max(0, Math.floor(cx - rad * 2));
    const r1 = Math.min(N - 1, Math.ceil(cx + rad * 2));
    const c0 = Math.max(0, Math.floor(cy - rad * 2));
    const c1 = Math.min(N - 1, Math.ceil(cy + rad * 2));
    for (let j = c0; j <= c1; j++) {
      for (let i = r0; i <= r1; i++) {
        const w = Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / (rad * rad));
        const k = i + j * N;
        cr[k] = Math.min(1.8, cr[k]! + rgb[0] * w * amt);
        cg[k] = Math.min(1.8, cg[k]! + rgb[1] * w * amt);
        cb[k] = Math.min(1.8, cb[k]! + rgb[2] * w * amt);
        vx[k] += fx * w;
        vy[k] += fy * w;
      }
    }
  }

  function sim(dt: number) {
    const stepDt = Math.min(0.033, dt);
    advect(vx, vx0, stepDt);
    advect(vy, vy0, stepDt);
    let t = vx; vx = vx0; vx0 = t;
    t = vy; vy = vy0; vy0 = t;
    if (params.viscosity > 0.01) {
      const a = stepDt * params.viscosity * 8;
      for (let s = 0; s < 4; s++) {
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const k = i + j * N;
            vx0[k] = (vx[k]! + a * (vx[id(i - 1, j)]! + vx[id(i + 1, j)]! + vx[id(i, j - 1)]! + vx[id(i, j + 1)]!)) / (1 + 4 * a);
            vy0[k] = (vy[k]! + a * (vy[id(i - 1, j)]! + vy[id(i + 1, j)]! + vy[id(i, j - 1)]! + vy[id(i, j + 1)]!)) / (1 + 4 * a);
          }
        }
        t = vx; vx = vx0; vx0 = t;
        t = vy; vy = vy0; vy0 = t;
      }
    }
    project(vx, vy);
    confine(params.vorticity * 0.15, stepDt);
    project(vx, vy);
    advect(cr, cr0, stepDt);
    advect(cg, cg0, stepDt);
    advect(cb, cb0, stepDt);
    t = cr; cr = cr0; cr0 = t;
    t = cg; cg = cg0; cg0 = t;
    t = cb; cb = cb0; cb0 = t;
    const fade = params.fade;
    for (let i = 0; i < n; i++) {
      cr[i] *= fade;
      cg[i] *= fade;
      cb[i] *= fade;
    }
    time += stepDt;
    const stir = params.stir;
    for (let k = 0; k < 3; k++) {
      const ang = time * (0.55 + k * 0.17) + k * 2.1;
      const u = 0.5 + Math.cos(ang) * (0.22 + k * 0.04);
      const v = 0.5 + Math.sin(ang * 1.17) * (0.2 + k * 0.03);
      const col = colors[1 + (k % 4)] ?? colors[1]!;
      splat(u, v, col, -Math.sin(ang) * 0.35 * stir, Math.cos(ang * 1.17) * 0.35 * stir, 2.8, 0.55);
    }
    if (pointer.down) {
      const col = colors[2] ?? [0.2, 1, 0.8];
      splat(pointer.u, pointer.v, col, pointer.dx * 28, pointer.dy * 28, 4.2, 1.3);
    }
  }

  function sample(src: Float32Array, u: number, v: number) {
    let x = ((u % N) + N) % N;
    let y = ((v % N) + N) % N;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const x1 = (x0 + 1) % N;
    const y1 = (y0 + 1) % N;
    return (
      src[x0 + y0 * N]! * (1 - tx) * (1 - ty) +
      src[x1 + y0 * N]! * tx * (1 - ty) +
      src[x0 + y1 * N]! * (1 - tx) * ty +
      src[x1 + y1 * N]! * tx * ty
    );
  }

  function paint() {
    if (!ctx || !canvas || colors.length < 1) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!img || img.width !== w || img.height !== h) img = ctx.createImageData(w, h);
    const d = img.data;
    const bg = colors[0]!;
    for (let y = 0; y < h; y++) {
      const fy = (y / Math.max(1, h - 1)) * (N - 1);
      for (let x = 0; x < w; x++) {
        const fx = (x / Math.max(1, w - 1)) * (N - 1);
        const r = sample(cr, fx, fy);
        const g = sample(cg, fx, fy);
        const b = sample(cb, fx, fy);
        const e = Math.max(r, g, b);
        const ex = sample(cr, fx + 0.8, fy) + sample(cg, fx + 0.8, fy) + sample(cb, fx + 0.8, fy);
        const ex0 = sample(cr, fx - 0.8, fy) + sample(cg, fx - 0.8, fy) + sample(cb, fx - 0.8, fy);
        const ey = sample(cr, fx, fy + 0.8) + sample(cg, fx, fy + 0.8) + sample(cb, fx, fy + 0.8);
        const ey0 = sample(cr, fx, fy - 0.8) + sample(cg, fx, fy - 0.8) + sample(cb, fx, fy - 0.8);
        const gx = ex - ex0;
        const gy = ey - ey0;
        const inv = 1 / Math.hypot(-gx * 2.2, -gy * 2.2, 1);
        const ndl = Math.max(0, -gx * 2.2 * inv * 0.3 + -gy * 2.2 * inv * 0.45 + inv * 0.84);
        const spec = Math.pow(ndl, 20) * Math.min(1, e * 2);
        const rgb: RGB = [
          bg[0] * (1 - Math.min(1, e)) + r * (0.35 + 0.8 * ndl) + spec,
          bg[1] * (1 - Math.min(1, e)) + g * (0.35 + 0.8 * ndl) + spec * 0.95,
          bg[2] * (1 - Math.min(1, e)) + b * (0.35 + 0.8 * ndl) + spec * 0.85,
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
        viscosity: p.viscosity ?? 0.18,
        vorticity: p.vorticity ?? 6,
        fade: p.fade ?? 0.992,
        stir: p.stir ?? 1,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) { pointer = s; },
    frame(_p, dt) {
      if (!alive) return;
      if (dt > 0) sim(dt);
      paint();
    },
    reset() {
      vx.fill(0); vy.fill(0); cr.fill(0); cg.fill(0); cb.fill(0);
      time = seed * 0.001;
      for (let i = 0; i < 24; i++) sim(0.016);
    },
    destroy() { alive = false; ctx = null; },
  };
}
