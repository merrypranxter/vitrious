import { cssRgb, hexToRgb, mulberry32, samplePal, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

const W = 128;
const H = 128;

type Seg = { x: number; y: number; px: number; py: number; t: number };

export function createFulgurite(seed: number): Engine {
  const n = W * H;
  const V = new Float32Array(n);
  const on = new Uint8Array(n);
  const cand = new Int32Array(n);
  const weight = new Float32Array(n);
  const segs: Seg[] = [];
  const body: number[] = [];
  let cells = 0;
  let rng = mulberry32(seed);
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let colors: RGB[] = [];
  let params = { eta: 1.2, branch: 2, relax: 3, thickness: 1.1 };
  let pointer: PointerState = { u: 0.5, v: 0.5, down: false, dx: 0, dy: 0 };
  let was = false;
  let alive = true;
  let sx = W >> 1;
  let sy = H >> 1;

  function border(i: number, j: number) {
    return i === 0 || j === 0 || i === W - 1 || j === H - 1;
  }

  function clear(x: number, y: number) {
    V.fill(1);
    on.fill(0);
    segs.length = 0;
    body.length = 0;
    cells = 0;
    sx = Math.max(1, Math.min(W - 2, x));
    sy = Math.max(1, Math.min(H - 2, y));
    const id = sy * W + sx;
    on[id] = 1;
    V[id] = 0;
    cells = 1;
    body.push(id);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) if (border(i, j)) V[j * W + i] = 1;
    }
  }

  function relax() {
    const sweeps = params.relax | 0;
    for (let s = 0; s < sweeps; s++) {
      for (let j = 1; j < H - 1; j++) {
        for (let i = 1; i < W - 1; i++) {
          const id = j * W + i;
          if (on[id]) {
            V[id] = 0;
            continue;
          }
          V[id] = 0.25 * (V[id - 1]! + V[id + 1]! + V[id - W]! + V[id + W]!);
        }
      }
    }
  }

  function growOne() {
    if (cells > 2600) return false;
    let nC = 0;
    let sum = 0;
    const eta = params.eta;
    for (let b = 0; b < body.length; b++) {
      const id = body[b]!;
      const nbs = [id - 1, id + 1, id - W, id + W];
      for (let k = 0; k < 4; k++) {
        const nb = nbs[k]!;
        if (on[nb]) continue;
        const nbx = nb % W;
        const nby = (nb / W) | 0;
        if (border(nbx, nby)) continue;
        const wgt = Math.pow(Math.max(0, V[nb]!), eta);
        if (wgt <= 0 || nC >= cand.length) continue;
        cand[nC] = nb;
        weight[nC] = wgt;
        sum += wgt;
        nC++;
      }
    }
    if (nC === 0 || sum <= 0) return false;
    let r = rng() * sum;
    let pick = cand[0]!;
    for (let i = 0; i < nC; i++) {
      r -= weight[i]!;
      if (r <= 0) {
        pick = cand[i]!;
        break;
      }
    }
    if (on[pick]) return true;
    on[pick] = 1;
    V[pick] = 0;
    cells++;
    body.push(pick);
    const px = pick % W;
    const py = (pick / W) | 0;
    segs.push({
      x: (px + 0.5) / W,
      y: (py + 0.5) / H,
      px: (sx + 0.5) / W,
      py: (sy + 0.5) / H,
      t: cells / 2600,
    });
    // parent is nearest on-neighbor, draw from it
    const nbs = [pick - 1, pick + 1, pick - W, pick + W];
    for (let k = 0; k < 4; k++) {
      const nb = nbs[k]!;
      if (nb !== pick && on[nb] && nb !== pick) {
        const nx = nb % W;
        const ny = (nb / W) | 0;
        if (on[nb]) {
          segs[segs.length - 1] = {
            x: (px + 0.5) / W,
            y: (py + 0.5) / H,
            px: (nx + 0.5) / W,
            py: (ny + 0.5) / H,
            t: cells / 2600,
          };
          break;
        }
      }
    }
    return true;
  }

  function burst(count: number) {
    relax();
    for (let i = 0; i < count; i++) {
      if (!growOne()) break;
    }
  }

  let field: HTMLCanvasElement | null = null;
  let fctx: CanvasRenderingContext2D | null = null;
  let fieldImg: ImageData | null = null;

  function paintField() {
    if (!field) {
      field = document.createElement("canvas");
      field.width = W;
      field.height = H;
      fctx = field.getContext("2d", { alpha: false });
    }
    if (!fctx || colors.length < 2) return;
    if (!fieldImg) fieldImg = fctx.createImageData(W, H);
    const d = fieldImg.data;
    const ground = colors[0] ?? [0.05, 0.03, 0.06];
    for (let i = 0; i < n; i++) {
      const v = Math.max(0, Math.min(1, V[i]!));
      const hot = on[i] ? 0 : Math.pow(v, 1.35);
      const col = samplePal(colors, 0.08 + 0.62 * hot);
      const lum = 0.08 + 0.72 * hot;
      const o = i * 4;
      d[o] = Math.max(ground[0]! * 18, Math.min(255, col[0] * lum * 255));
      d[o + 1] = Math.max(ground[1]! * 18, Math.min(255, col[1] * lum * 255));
      d[o + 2] = Math.max(ground[2]! * 18, Math.min(255, col[2] * lum * 255));
      d[o + 3] = 255;
    }
    fctx.putImageData(fieldImg, 0, 0);
  }

  function paint() {
    if (!ctx || !canvas || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    paintField();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (field) ctx.drawImage(field, 0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = "lighter";
    const thick = params.thickness;
    for (let pass = 0; pass < 3; pass++) {
      for (const s of segs) {
        const col = samplePal(colors, 0.22 + 0.74 * s.t);
        ctx.beginPath();
        ctx.moveTo(s.px * w, s.py * h);
        ctx.lineTo(s.x * w, s.y * h);
        if (pass === 0) {
          ctx.globalAlpha = 0.22;
          ctx.lineWidth = Math.max(3, w * 0.02 * thick);
        } else if (pass === 1) {
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = Math.max(1.5, w * 0.007 * thick);
        } else {
          ctx.globalAlpha = 0.95;
          ctx.lineWidth = Math.max(1, w * 0.0024 * thick);
        }
        ctx.strokeStyle = cssRgb(col);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  return {
    periodic: false,
    mount(c) {
      canvas = c;
      const g = c.getContext("2d", { alpha: false });
      if (!g) throw new Error("Could not draw this material.");
      ctx = g;
    },
    setBitmap(w, h) {
      if (!canvas) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    },
    setParams(p) {
      params = {
        eta: p.eta ?? 1.2,
        branch: p.branch ?? 2,
        relax: p.relax ?? 3,
        thickness: p.thickness ?? 1,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) {
      pointer = s;
      if (s.down && !was) {
        rng = mulberry32((seed + Math.floor(s.u * 1000) + Math.floor(s.v * 700)) >>> 0);
        clear(Math.floor(s.u * W), Math.floor(s.v * H));
        for (let i = 0; i < 16; i++) burst(3);
      }
      was = s.down;
    },
    frame(_p, dt) {
      if (!alive) return;
      if (dt > 0 && cells < 2600) burst(Math.max(1, params.branch | 0));
      paint();
    },
    reset() {
      rng = mulberry32(seed);
      clear(W >> 1, H >> 1);
      for (let i = 0; i < 36; i++) burst(4);
    },
    destroy() { alive = false; ctx = null; },
  };
}
