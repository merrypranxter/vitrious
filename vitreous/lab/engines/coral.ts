import { cssRgb, hexToRgb, samplePal, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

type Loop = { x: number[]; y: number[]; hue: number };

export function createCoral(seed: number): Engine {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let colors: RGB[] = [];
  let params = { repel: 0.032, split: 0.02, smooth: 0.16, growth: 0.85 };
  let pointer: PointerState = { u: 0, v: 0, down: false, dx: 0, dy: 0 };
  let was = false;
  let loops: Loop[] = [];
  let alive = true;
  const maxN = 640;

  function addLoop(cx: number, cy: number, rad: number, hue: number, count = 26) {
    const L: Loop = { x: [], y: [], hue };
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + seed * 0.001;
      L.x.push(cx + Math.cos(a) * rad);
      L.y.push(cy + Math.sin(a) * rad * 0.86);
    }
    loops.push(L);
  }

  function boot() {
    loops = [];
    addLoop(0.5, 0.5, 0.12, 0.22);
    addLoop(0.36, 0.42, 0.07, 0.48);
    addLoop(0.64, 0.58, 0.08, 0.74);
    for (let i = 0; i < 46; i++) iterate();
  }

  function iterate() {
    const R = params.repel;
    const gain = 0.15 * params.growth;
    const stiff = params.smooth;
    for (const loop of loops) {
      const n = loop.x.length;
      if (n < 4) continue;
      const buckets = new Map<number, number[]>();
      const key = (x: number, y: number) => ((Math.floor(x / R) + 80) << 10) ^ (Math.floor(y / R) + 80);
      for (let i = 0; i < n; i++) {
        const k = key(loop.x[i]!, loop.y[i]!);
        const arr = buckets.get(k);
        if (arr) arr.push(i);
        else buckets.set(k, [i]);
      }
      const nx = new Array<number>(n);
      const ny = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        let fx = 0;
        let fy = 0;
        const x = loop.x[i]!;
        const y = loop.y[i]!;
        const ix = Math.floor(x / R);
        const iy = Math.floor(y / R);
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const arr = buckets.get(((ix + ox + 80) << 10) ^ (iy + oy + 80));
            if (!arr) continue;
            for (const j of arr) {
              if (j === i) continue;
              const dx = x - loop.x[j]!;
              const dy = y - loop.y[j]!;
              const d = Math.hypot(dx, dy);
              if (d > 1e-5 && d < R) {
                const w = (R - d) / d;
                fx += dx * w;
                fy += dy * w;
              }
            }
          }
        }
        const p = (i - 1 + n) % n;
        const q = (i + 1) % n;
        fx += ((loop.x[p]! + loop.x[q]!) * 0.5 - x) * stiff * 6;
        fy += ((loop.y[p]! + loop.y[q]!) * 0.5 - y) * stiff * 6;
        if (x < 0.05) fx += 0.8;
        if (x > 0.95) fx -= 0.8;
        if (y < 0.05) fy += 0.8;
        if (y > 0.95) fy -= 0.8;
        nx[i] = x + fx * gain;
        ny[i] = y + fy * gain;
      }
      loop.x = nx;
      loop.y = ny;
      if (loop.x.length >= maxN) continue;
      const sx: number[] = [];
      const sy: number[] = [];
      const m = loop.x.length;
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m;
        sx.push(loop.x[i]!);
        sy.push(loop.y[i]!);
        const dx = loop.x[j]! - loop.x[i]!;
        const dy = loop.y[j]! - loop.y[i]!;
        if (Math.hypot(dx, dy) > params.split && sx.length < maxN) {
          sx.push(loop.x[i]! + dx * 0.5);
          sy.push(loop.y[i]! + dy * 0.5);
        }
      }
      loop.x = sx;
      loop.y = sy;
    }
  }

  function paint() {
    if (!ctx || !canvas || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = cssRgb(colors[0] ?? [0.04, 0.03, 0.05]);
    ctx.fillRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const loop of loops) {
      const n = loop.x.length;
      const lw = Math.max(2, w * 0.011);
      for (let i = 0; i < n; i += 5) {
        const a = i;
        const b = Math.min(n, i + 6);
        ctx.beginPath();
        ctx.moveTo(loop.x[a]! * w, loop.y[a]! * h);
        for (let k = a + 1; k < b; k++) ctx.lineTo(loop.x[k]! * w, loop.y[k]! * h);
        const j = (i + 1) % n;
        const p = (i - 1 + n) % n;
        const tx = loop.x[j]! - loop.x[p]!;
        const ty = loop.y[j]! - loop.y[p]!;
        const inv = 1 / (Math.hypot(tx, ty) || 1);
        const nx = -ty * inv;
        const ny = tx * inv;
        const spec = Math.max(0, nx * 0.35 + ny * -0.75);
        const col = samplePal(colors, (loop.hue + 0.08 * Math.sin(i * 0.15)) % 1);
        ctx.strokeStyle = cssRgb(col);
        ctx.lineWidth = lw * (0.85 + spec);
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,248,236,${0.15 + spec * 0.7})`;
        ctx.lineWidth = lw * 0.35;
        ctx.stroke();
      }
    }
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
        repel: p.repel ?? 0.032,
        split: p.split ?? 0.02,
        smooth: p.smooth ?? 0.16,
        growth: p.growth ?? 0.85,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) {
      pointer = s;
      if (s.down && !was && loops.length < 5) {
        addLoop(s.u, s.v, 0.055, (loops.length * 0.17 + 0.3) % 1, 20);
      }
      was = s.down;
    },
    frame(_p, dt) {
      if (!alive) return;
      if (dt > 0) {
        iterate();
        if (dt > 0.02) iterate();
      }
      paint();
    },
    reset() { boot(); },
    destroy() { alive = false; ctx = null; loops = []; },
  };
}
