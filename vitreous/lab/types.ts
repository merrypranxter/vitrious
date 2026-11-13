export type Param = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  hint: string;
  integer?: boolean;
};

export type Experiment = {
  id: string;
  name: string;
  principle: string;
  blurb: string;
  touch: string;
  periodic: boolean;
  mode: "webgl" | "2d";
  cap: number;
  parameters: Param[];
};

export type PointerState = {
  u: number;
  v: number;
  down: boolean;
  dx: number;
  dy: number;
};

export type Engine = {
  periodic: boolean;
  mount(canvas: HTMLCanvasElement): void;
  setBitmap(w: number, h: number): void;
  setParams(p: Record<string, number>): void;
  setPalette(hex: string[]): void;
  setPointer(p: PointerState): void;
  frame(phase: number, dt: number): void;
  reset(): void;
  destroy(): void;
};

export function defaults(exp: Experiment): Record<string, number> {
  const o: Record<string, number> = {};
  for (const p of exp.parameters) o[p.key] = p.value;
  return o;
}
