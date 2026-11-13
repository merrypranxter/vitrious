export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function samplePal(colors: RGB[], t: number): RGB {
  const n = colors.length;
  const x = Math.min(0.9999, Math.max(0, t)) * (n - 1);
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = colors[i]!;
  const b = colors[Math.min(n - 1, i + 1)]!;
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
}

export function cssRgb(c: RGB, a = 1): string {
  const r = Math.round(Math.min(255, Math.max(0, c[0] * 255)));
  const g = Math.round(Math.min(255, Math.max(0, c[1] * 255)));
  const b = Math.round(Math.min(255, Math.max(0, c[2] * 255)));
  return a === 1 ? `rgb(${r} ${g} ${b})` : `rgba(${r},${g},${b},${a})`;
}

export function writePx(data: Uint8ClampedArray, o: number, c: RGB) {
  data[o] = Math.min(255, Math.max(0, c[0] * 255));
  data[o + 1] = Math.min(255, Math.max(0, c[1] * 255));
  data[o + 2] = Math.min(255, Math.max(0, c[2] * 255));
  data[o + 3] = 255;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
