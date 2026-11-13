import { cssRgb, hexToRgb, mulberry32, samplePal, type RGB } from "../color";
import type { Engine, PointerState } from "../types";

export function createSinai(seed: number): Engine {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let colors: RGB[] = [];
  let rng = mulberry32(seed);
  let params = { radius: 0.13, rays: 380, swirl: 0.4, fade: 0.07, wander: 0.05 };
  let pointer: PointerState = { u: 0.5, v: 0.5, down: false, dx: 0, dy: 0 };
  let rays = new Float32Array(0);
  let count = 0;
  let time = 0;
  let alive = true;
  let hold = false;

  function launch(i: number, cx: number, cy: number, r: number) {
    const ang = rng() * Math.PI * 2;
    const swirl = params.swirl;
    const tang = ang + Math.PI / 2;
    let vx = Math.cos(ang) * (1 - swirl) + Math.cos(tang) * swirl;
    let vy = Math.sin(ang) * (1 - swirl) + Math.sin(tang) * swirl;
    const m = Math.hypot(vx, vy) || 1;
    const sp = 0.42;
    vx = (vx / m) * sp;
    vy = (vy / m) * sp;
    const o = i * 5;
    rays[o] = cx + Math.cos(ang) * (r + 0.02);
    rays[o + 1] = cy + Math.sin(ang) * (r + 0.02);
    rays[o + 2] = vx;
    rays[o + 3] = vy;
    rays[o + 4] = rng();
  }

  function ensure() {
    const want = Math.max(8, params.rays | 0);
    if (want === count && rays.length >= want * 5) return;
    const next = new Float32Array(want * 5);
    const keep = Math.min(count, want);
    next.set(rays.subarray(0, keep * 5));
    rays = next;
    count = want;
    const { cx, cy, r } = disk(0);
    for (let i = keep; i < want; i++) launch(i, cx, cy, r);
  }

  function disk(phase: number) {
    const r = params.radius;
    if (hold) return { cx: pointer.u, cy: pointer.v, r };
    const w = params.wander;
    return {
      cx: 0.5 + Math.cos(phase * Math.PI * 2) * w,
      cy: 0.5 + Math.sin(phase * Math.PI * 2 * 0.8) * w * 0.85,
      r,
    };
  }

  function step(dt: number, phase: number) {
    ensure();
    const { cx, cy, r } = disk(phase);
    const sub = 3;
    const h = dt / sub;
    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < count; i++) {
        const o = i * 5;
        let x = rays[o]!;
        let y = rays[o + 1]!;
        let vx = rays[o + 2]!;
        let vy = rays[o + 3]!;
        x += vx * h;
        y += vy * h;
        if (x < 0) { x = -x; vx = Math.abs(vx); }
        if (y < 0) { y = -y; vy = Math.abs(vy); }
        if (x > 1) { x = 2 - x; vx = -Math.abs(vx); }
        if (y > 1) { y = 2 - y; vy = -Math.abs(vy); }
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 0.0001;
          const nx = dx / d;
          const ny = dy / d;
          x = cx + nx * (r + 0.002);
          y = cy + ny * (r + 0.002);
          const dot = vx * nx + vy * ny;
          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
        }
        const sp = Math.hypot(vx, vy);
        if (sp < 0.05 || sp > 2 || !Number.isFinite(x)) {
          launch(i, cx, cy, r);
          continue;
        }
        rays[o] = x;
        rays[o + 1] = y;
        rays[o + 2] = vx;
        rays[o + 3] = vy;
      }
    }
  }

  function paint(phase: number) {
    if (!ctx || !canvas || colors.length < 2) return;
    const w = canvas.width;
    const h = canvas.height;
    const { cx, cy, r } = disk(phase);
    ctx.fillStyle = `rgba(0,0,0,${Math.min(0.45, params.fade)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = Math.max(1, w * 0.0016);
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const o = i * 5;
      const x = rays[o]!;
      const y = rays[o + 1]!;
      const vx = rays[o + 2]!;
      const vy = rays[o + 3]!;
      const col = samplePal(colors, rays[o + 4]!);
      ctx.strokeStyle = cssRgb(col, 0.55);
      ctx.beginPath();
      ctx.moveTo((x - vx * 0.012) * w, (y - vy * 0.012) * h);
      ctx.lineTo(x * w, y * h);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.beginPath();
    ctx.fillStyle = cssRgb(colors[0] ?? [0.02, 0.02, 0.03]);
    ctx.arc(cx * w, cy * h, r * Math.min(w, h), 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = cssRgb(samplePal(colors, 0.85));
    ctx.stroke();
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
      if (!canvas || !ctx) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        ctx.fillStyle = "#050506";
        ctx.fillRect(0, 0, w, h);
      }
    },
    setParams(p) {
      params = {
        radius: p.radius ?? 0.13,
        rays: p.rays ?? 380,
        swirl: p.swirl ?? 0.4,
        fade: p.fade ?? 0.07,
        wander: p.wander ?? 0.05,
      };
    },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) {
      pointer = s;
      hold = s.down;
    },
    frame(phase, dt) {
      if (!alive) return;
      time += dt;
      if (dt > 0) step(Math.min(0.033, dt), time);
      paint(time);
    },
    reset() {
      rng = mulberry32(seed);
      count = 0;
      rays = new Float32Array(0);
      time = 0;
      if (ctx && canvas) {
        ctx.fillStyle = "#050506";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ensure();
        for (let i = 0; i < 24; i++) {
          step(0.016, i / 24);
          paint(i / 24);
        }
      }
    },
    destroy() { alive = false; ctx = null; },
  };
}
