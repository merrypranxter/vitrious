import { useEffect, useRef, useState } from "react";
import { Clapperboard, Dices, Eye, EyeOff, Image, Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { experimentById, experiments } from "./catalog";
import { encodeGif, encodeMp4, evenSize } from "./export";
import { createEngine } from "./engines";
import { paletteById, palettes } from "./palettes";
import { defaults, type Engine, type Experiment, type Param, type PointerState } from "./types";

const KEY = "vitreous.v1";

function bitmapSize(cssW: number, cssH: number, cap: number) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w = Math.max(2, Math.round(cssW * dpr));
  let h = Math.max(2, Math.round(cssH * dpr));
  const m = Math.max(w, h);
  if (m > cap) {
    const s = cap / m;
    w = Math.max(2, Math.round(w * s));
    h = Math.max(2, Math.round(h * s));
  }
  return { w, h };
}

function fmtNum(param: Param, v: number) {
  if (param.integer) return String(Math.round(v));
  const d = param.step < 0.01 ? 3 : 2;
  return v.toFixed(d);
}

function mutate(exp: Experiment): Record<string, number> {
  const o: Record<string, number> = {};
  for (const param of exp.parameters) {
    const u = (Math.random() + Math.random()) / 2;
    let v = param.min + (param.max - param.min) * u;
    if (param.integer) v = Math.round(v);
    const step = param.step;
    v = Math.round(v / step) * step;
    o[param.key] = Math.min(param.max, Math.max(param.min, v));
  }
  return o;
}

type Aspect = "1:1" | "4:5" | "9:16" | "16:9";

function aspectParts(aspect: Aspect): [number, number] {
  if (aspect === "4:5") return [4, 5];
  if (aspect === "9:16") return [9, 16];
  if (aspect === "16:9") return [16, 9];
  return [1, 1];
}

export function Bench() {
  const [hydrated, setHydrated] = useState(false);
  const [id, setId] = useState(experiments[0]!.id);
  const [params, setParams] = useState<Record<string, number>>(() => defaults(experiments[0]!));
  const [palId, setPalId] = useState(palettes[0]!.id);
  const [seed, setSeed] = useState(74281);
  const [paused, setPaused] = useState(false);
  const [bare, setBare] = useState(false);
  const [loopSec, setLoopSec] = useState(8);
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [fmt, setFmt] = useState<"mp4" | "gif">("mp4");
  const [short, setShort] = useState(720);
  const [fps, setFps] = useState(30);
  const [hint, setHint] = useState(experiments[0]!.parameters[0]?.hint ?? "");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ url: string; name: string; meta: string } | null>(null);

  const exp = experimentById(id);
  const pal = paletteById(palId);
  const glRef = useRef<HTMLCanvasElement>(null);
  const cpuRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const engRef = useRef<Engine | null>(null);
  const paramsRef = useRef(params);
  const palRef = useRef(pal.colors);
  const pausedRef = useRef(paused);
  const loopRef = useRef(loopSec);
  const exportingRef = useRef(false);
  const phaseRef = useRef(0);
  const scrubRef = useRef(false);
  const expRef = useRef(exp);
  const pointer = useRef<PointerState>({ u: 0.5, v: 0.5, down: false, dx: 0, dy: 0 });
  const fpsEl = useRef<HTMLSpanElement>(null);
  const scrubEl = useRef<HTMLInputElement>(null);
  const scrubOut = useRef<HTMLOutputElement>(null);

  paramsRef.current = params;
  palRef.current = pal.colors;
  pausedRef.current = paused;
  loopRef.current = loopSec;
  expRef.current = exp;

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const saved = localStorage.getItem(KEY);
      const base = saved ? (JSON.parse(saved) as Record<string, unknown>) : {};
      const mid = (q.get("m") || base.id) as string | undefined;
      const next = experimentById(mid || experiments[0]!.id);
      const storedParams = (base.params && typeof base.params === "object" ? base.params : {}) as Record<string, number>;
      const merged = defaults(next);
      if (!q.get("m")) {
        for (const param of next.parameters) {
          const v = storedParams[param.key];
          if (typeof v === "number" && Number.isFinite(v)) merged[param.key] = v;
        }
      }
      q.forEach((val, key) => {
        if (key.length === 1 || key.startsWith("k")) return;
        const param = next.parameters.find((item) => item.key === key);
        if (!param) return;
        const v = Number(val);
        if (Number.isFinite(v)) merged[param.key] = v;
      });
      setId(next.id);
      setParams(merged);
      setPalId(paletteById((q.get("p") || (base.palId as string) || palettes[0]!.id)).id);
      const s = Number(q.get("s") || base.seed);
      if (Number.isFinite(s) && s > 0) setSeed(s >>> 0);
      if (base.loopSec === 4 || base.loopSec === 8 || base.loopSec === 12) setLoopSec(base.loopSec);
      if (base.aspect === "1:1" || base.aspect === "4:5" || base.aspect === "9:16" || base.aspect === "16:9") setAspect(base.aspect);
      if (base.fmt === "gif" || base.fmt === "mp4") setFmt(base.fmt);
      if (base.short === 480 || base.short === 720 || base.short === 1080) setShort(base.short);
      if (typeof base.fps === "number") setFps(base.fps);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPaused(true);
    } catch {
      /* keep defaults */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify({ id, params, palId, seed, loopSec, aspect, fmt, short, fps }));
  }, [hydrated, id, params, palId, seed, loopSec, aspect, fmt, short, fps]);

  useEffect(() => {
    if (!hydrated) return;
    const canvas = exp.mode === "webgl" ? glRef.current : cpuRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    setError("");
    let engine: Engine;
    try {
      engine = createEngine(exp.id, seed);
      engine.mount(canvas);
      engine.setParams(paramsRef.current);
      engine.setPalette(palRef.current);
      engine.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "This material failed to start.");
      return;
    }
    engRef.current = engine;
    const fit = () => {
      if (exportingRef.current) return;
      const r = stage.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const size = bitmapSize(r.width, r.height, expRef.current.cap);
      engine.setBitmap(size.w, size.h);
    };
    fit();
    try { engine.frame(phaseRef.current, 0); } catch (e) {
      setError(e instanceof Error ? e.message : "This material failed to draw.");
    }
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let fpsT = last;
    let bad = false;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!exportingRef.current) {
        if (!pausedRef.current && !scrubRef.current) {
          phaseRef.current = (phaseRef.current + dt / Math.max(0.5, loopRef.current)) % 1;
        }
        if (!scrubRef.current && scrubEl.current) {
          scrubEl.current.value = phaseRef.current.toFixed(3);
          if (scrubOut.current) scrubOut.current.textContent = phaseRef.current.toFixed(2);
        }
        try {
          engine.setParams(paramsRef.current);
          engine.setPalette(palRef.current);
          engine.setPointer(pointer.current);
          engine.frame(phaseRef.current, pausedRef.current ? 0 : dt);
          pointer.current.dx = 0;
          pointer.current.dy = 0;
        } catch (e) {
          if (!bad) {
            bad = true;
            setError(e instanceof Error ? e.message : "This material failed while running.");
          }
        }
      }
      frames++;
      if (now - fpsT > 500 && fpsEl.current) {
        fpsEl.current.textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps`;
        frames = 0;
        fpsT = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      engine.destroy();
      if (engRef.current === engine) engRef.current = null;
    };
  }, [hydrated, id, seed, exp.mode, exp.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); setPaused((v) => !v); }
      else if (e.key === "m" || e.key === "M") doMutate();
      else if (e.key === "h" || e.key === "H") setBare((v) => !v);
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const i = experiments.findIndex((item) => item.id === expRef.current.id);
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = experiments[(i + dir + experiments.length) % experiments.length]!;
        open(next);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function open(next: Experiment) {
    setId(next.id);
    setParams(defaults(next));
    setHint(next.parameters[0]?.hint ?? "");
    setError("");
    phaseRef.current = 0;
  }

  function doMutate() {
    const cur = expRef.current;
    setParams(mutate(cur));
    setSeed((s) => (s + 1 + Math.floor(Math.random() * 9999)) >>> 0);
    setHint("Mutated inside a stable range of this material.");
  }

  function uv(e: React.PointerEvent) {
    const r = stageRef.current!.getBoundingClientRect();
    return {
      u: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      v: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const p = uv(e);
    pointer.current = { ...p, down: true, dx: 0, dy: 0 };
  }
  function onMove(e: React.PointerEvent) {
    const p = uv(e);
    if (!pointer.current.down) {
      pointer.current = { ...p, down: false, dx: 0, dy: 0 };
      return;
    }
    pointer.current = { u: p.u, v: p.v, down: true, dx: p.u - pointer.current.u, dy: p.v - pointer.current.v };
  }
  function onUp() {
    pointer.current = { ...pointer.current, down: false, dx: 0, dy: 0 };
  }

  async function exportStill() {
    const engine = engRef.current;
    const canvas = exp.mode === "webgl" ? glRef.current : cpuRef.current;
    if (!engine || !canvas || exporting) return;
    setExporting(true);
    exportingRef.current = true;
    const prev = { w: canvas.width, h: canvas.height };
    try {
      const [W, H] = evenSize(aspect, Math.max(short, 1080));
      engine.setBitmap(W, H);
      engine.setParams(paramsRef.current);
      engine.setPalette(palRef.current);
      engine.frame(phaseRef.current, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not encode the still.");
      showBlob(blob, "png", W, H);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Still failed.");
    } finally {
      engine.setBitmap(prev.w, prev.h);
      exportingRef.current = false;
      setExporting(false);
    }
  }

  async function exportLoop() {
    const engine = engRef.current;
    const canvas = exp.mode === "webgl" ? glRef.current : cpuRef.current;
    if (!engine || !canvas || exporting) return;
    setExporting(true);
    exportingRef.current = true;
    setProgress(0);
    setStatus("Starting");
    const prev = { w: canvas.width, h: canvas.height };
    const useFps = fmt === "gif" ? Math.min(fps, 20) : fps;
    const N = Math.max(2, Math.round(useFps * loopSec));
    const [W, H] = evenSize(aspect, fmt === "gif" ? Math.min(short, 720) : short);
    try {
      engine.setBitmap(W, H);
      engine.setParams(paramsRef.current);
      engine.setPalette(palRef.current);
      if (!exp.periodic) engine.reset();
      const grab = document.createElement("canvas");
      grab.width = W;
      grab.height = H;
      const g = grab.getContext("2d");
      if (!g) throw new Error("Could not allocate an export frame.");
      const frame = (i: number) => {
        if (exp.periodic) engine.frame(i / N, 0);
        else engine.frame(0, 1 / useFps);
        g.drawImage(canvas, 0, 0, W, H);
      };
      const onProg = (f: number, text: string) => { setProgress(f); setStatus(text); };
      const blob = fmt === "gif"
        ? await encodeGif(W, H, useFps, N, frame, grab, onProg)
        : await encodeMp4(W, H, useFps, N, frame, grab, onProg);
      showBlob(blob, fmt === "gif" ? "gif" : "mp4", W, H, N);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Export failed.");
    } finally {
      engine.setBitmap(prev.w, prev.h);
      exportingRef.current = false;
      setExporting(false);
      setStatus("");
    }
  }

  function showBlob(blob: Blob, ext: string, W: number, H: number, frames?: number) {
    setResult((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      const url = URL.createObjectURL(blob);
      const name = `vitreous-${exp.id}-${pal.id}.${ext}`;
      const mb = blob.size / 1e6;
      const meta = `${ext.toUpperCase()} · ${W}×${H}${frames ? ` · ${frames} frames` : ""} · ${mb.toFixed(mb > 10 ? 0 : 1)} MB`;
      return { url, name, meta };
    });
    setNote(exp.periodic
      ? "Analytic loop: frame 0 and the last frame are the same state."
      : "This one evolves. The clip starts from a fresh seed and does not seam back to the first frame.");
  }

  async function copyRecipe() {
    const q = new URLSearchParams();
    q.set("m", exp.id);
    q.set("p", pal.id);
    q.set("s", String(seed));
    for (const [k, v] of Object.entries(params)) q.set(k, String(Math.round(v * 1000) / 1000));
    const url = `${location.origin}${location.pathname}?${q.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      setNote("Recipe copied.");
    } catch {
      setNote(url);
    }
  }

  const [aw, ah] = aspectParts(aspect);
  const periodicNote = exp.periodic
    ? "A function of one phase. The loop closes."
    : "It keeps evolving. A recording is a clip, not a seamless loop.";

  return (
    <div className="wrap">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none font-semibold tracking-tight sm:text-5xl">Vitreous</h1>
          {!bare && (
            <p className="mt-2 max-w-xl text-sm text-dim">
              Twelve materials, twelve mechanisms. Drag the plate. The sliders change the system, not a coat of color.
            </p>
          )}
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-bench px-3 text-sm"
          onClick={() => setBare((v) => !v)}
        >
          {bare ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {bare ? "Show bench" : "Hide bench"}
        </button>
      </header>

      <div className={bare ? "" : "grid items-start gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"}>
        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-3">
          <div className="stage-shell">
            <div
              ref={stageRef}
              className="stage-fit"
              style={{ "--ar": `${aw}/${ah}`, "--arn": (aw / ah).toFixed(4) } as React.CSSProperties}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            >
              <canvas ref={glRef} className={exp.mode === "webgl" ? "z-10" : "invisible"} />
              <canvas ref={cpuRef} className={exp.mode === "2d" ? "z-10" : "invisible"} />
              <div className="pointer-events-none absolute top-2 left-2 z-20 flex gap-2">
                <span className="rounded bg-void/80 px-2 py-1 font-mono text-[10px] tracking-widest text-ink uppercase">{exp.name}</span>
                <span ref={fpsEl} className="rounded bg-void/80 px-2 py-1 font-mono text-[10px] text-dim" />
              </div>
              {error && (
                <div className="absolute inset-0 z-30 grid place-items-center bg-void/80 p-4 text-center text-sm">{error}</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-signal px-4 text-sm font-semibold text-void" onClick={() => setPaused((v) => !v)}>
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              {paused ? "Play" : "Pause"}
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-bench px-3 text-sm" onClick={doMutate}>
              <Dices className="size-4" /> Mutate
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-bench px-3 text-sm" onClick={() => setSeed((s) => (s + 997) >>> 0)}>
              <RotateCcw className="size-4" /> Reseed
            </button>
            {exp.periodic && (
              <label className="flex min-w-40 flex-1 items-center gap-2">
                <input
                  ref={scrubEl}
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  defaultValue={0}
                  aria-label="Loop phase"
                  onPointerDown={() => { scrubRef.current = true; }}
                  onPointerUp={() => { scrubRef.current = false; }}
                  onChange={(e) => {
                    phaseRef.current = Number(e.target.value);
                    if (scrubOut.current) scrubOut.current.textContent = phaseRef.current.toFixed(2);
                  }}
                />
                <output ref={scrubOut} className="w-10 text-right font-mono text-xs text-dim">0.00</output>
              </label>
            )}
          </div>
        </div>

        {!bare && (
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Materials">
              {experiments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={item.id === exp.id}
                  className={`min-h-11 shrink-0 rounded-full border px-3 text-sm ${item.id === exp.id ? "border-ink bg-ink text-void" : "border-line bg-bench text-ink"}`}
                  onClick={() => (item.id === exp.id ? open(item) : open(item))}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <section className="flex flex-col gap-2 rounded-2xl border border-line bg-bench p-4">
              <p className="font-mono text-[11px] tracking-widest text-dim uppercase">{exp.principle}</p>
              <h2 className="font-display text-3xl leading-none italic">{exp.name}</h2>
              <p className="text-sm text-dim">{exp.blurb}</p>
              <p className="text-sm">{exp.touch}</p>
              <p className="font-mono text-xs text-dim">{periodicNote} Seed {seed}.</p>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-bench p-4">
              <h3 className="font-mono text-[11px] tracking-widest text-dim uppercase">Mechanism</h3>
              {exp.parameters.map((param) => (
                <label key={param.key} className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{param.label}</span>
                    <span className="font-mono text-xs text-signal">{fmtNum(param, params[param.key] ?? param.value)}</span>
                  </span>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={params[param.key] ?? param.value}
                    aria-label={param.label}
                    onPointerDown={() => setHint(param.hint)}
                    onChange={(e) => {
                      const v = param.integer ? Math.round(Number(e.target.value)) : Number(e.target.value);
                      setParams((prev) => ({ ...prev, [param.key]: v }));
                      setHint(param.hint);
                    }}
                  />
                </label>
              ))}
              <p className="text-xs text-dim">{hint}</p>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-bench p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-mono text-[11px] tracking-widest text-dim uppercase">Palette</h3>
                <span className="text-sm">{pal.name}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {pal.colors.map((c) => (
                  <span key={c} className="aspect-square rounded-lg border border-line" style={{ background: c }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm" onClick={() => setPalId(palettes[Math.floor(Math.random() * palettes.length)]!.id)}>
                  <Shuffle className="size-4" /> Shuffle
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-line px-3 text-sm"
                  onClick={() => {
                    const i = palettes.findIndex((item) => item.id === pal.id);
                    setPalId(palettes[(i + 1) % palettes.length]!.id);
                  }}
                >
                  Next
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {palettes.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={item.id === pal.id}
                    className={`min-h-11 rounded-lg border p-1 ${item.id === pal.id ? "border-signal" : "border-line"}`}
                    onClick={() => setPalId(item.id)}
                  >
                    <span className="flex h-3 w-16 overflow-hidden rounded">
                      {item.colors.map((c) => <span key={c} className="h-full flex-1" style={{ background: c }} />)}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2xl border border-line bg-bench p-4">
              <h3 className="font-mono text-[11px] tracking-widest text-dim uppercase">Export</h3>
              <div className="grid grid-cols-2 gap-3">
                <Seg label="Format" value={fmt} options={[["mp4", "MP4"], ["gif", "GIF"]]} onChange={(v) => setFmt(v as "mp4" | "gif")} />
                <Seg label="Shape" value={aspect} options={[["1:1", "1:1"], ["4:5", "4:5"], ["9:16", "9:16"], ["16:9", "16:9"]]} onChange={(v) => setAspect(v as Aspect)} />
                <Seg label="Short side" value={String(short)} options={[["480", "480"], ["720", "720"], ["1080", "1080"]]} onChange={(v) => setShort(Number(v))} />
                <Seg
                  label="Frame rate"
                  value={String(fps)}
                  options={fmt === "gif" ? [["12", "12"], ["15", "15"], ["20", "20"]] : [["24", "24"], ["30", "30"], ["60", "60"]]}
                  onChange={(v) => setFps(Number(v))}
                />
              </div>
              <label className="flex flex-col gap-1 text-sm">
                <span className="flex justify-between"><span>Loop length</span><span className="font-mono text-xs text-signal">{loopSec.toFixed(0)} s</span></span>
                <input type="range" min={4} max={12} step={4} value={loopSec} aria-label="Loop length" onChange={(e) => setLoopSec(Number(e.target.value))} />
              </label>
              <p className="text-xs text-dim">
                {exp.periodic
                  ? "Phase-exact. GIF still quantizes color, so MP4 is the honest moving copy."
                  : "Recorded from a reseeded run. It will not loop seamlessly — the system has a memory."}
                {" "}Tempo of the looping materials follows this length.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-void disabled:opacity-40" disabled={exporting} onClick={exportLoop}>
                  <Clapperboard className="size-4" /> {fmt === "gif" ? "Render GIF" : "Render MP4"}
                </button>
                <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm disabled:opacity-40" disabled={exporting} onClick={exportStill}>
                  <Image className="size-4" /> PNG still
                </button>
                <button type="button" className="min-h-11 rounded-xl border border-line px-3 text-sm" onClick={copyRecipe}>Copy recipe</button>
              </div>
              {exporting && (
                <div>
                  <div className="h-1.5 overflow-hidden rounded bg-void"><div className="h-full bg-signal" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                  <p className="mt-1 font-mono text-xs text-dim">{status}</p>
                </div>
              )}
              {note && <p className="text-xs break-all text-dim">{note}</p>}
              {result && (
                <div className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-xl bg-void p-2">
                    {result.name.endsWith(".mp4") ? (
                      <video src={result.url} className="max-h-80 w-full" controls loop muted playsInline autoPlay />
                    ) : (
                      <img src={result.url} alt="Exported frame" className="max-h-80 w-full object-contain" />
                    )}
                  </div>
                  <p className="font-mono text-xs text-dim">{result.meta}</p>
                  <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-signal px-4 text-sm font-semibold text-void" href={result.url} download={result.name}>Download</a>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
      <footer className="border-t border-line pt-3 text-xs text-dim">
        Space pauses. M mutates. H hides the bench. Arrows change materials. Polariscope, Basilica, Leadlight, Switchyard, and Reliquary are exact functions of phase. The rest remember their past.
      </footer>
    </div>
  );
}

function Seg({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-dim">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            className={`min-h-11 rounded-lg px-2.5 text-sm ${value === v ? "bg-ink text-void" : "border border-line"}`}
            onClick={() => onChange(v!)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
