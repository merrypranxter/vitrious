export type Palette = { id: string; name: string; colors: string[] };

export const palettes: Palette[] = [
  { id: "carnival", name: "Carnival glass", colors: ["#14080e", "#ff2e63", "#ffb703", "#2ef2c2", "#9b6bff"] },
  { id: "bile", name: "Bile lamp", colors: ["#120816", "#d6ff3a", "#19f0c8", "#ff3bd1", "#ffe56a"] },
  { id: "magma", name: "Magma pearl", colors: ["#160806", "#ff4d1c", "#ffb199", "#b44bff", "#ffd56a"] },
  { id: "tide", name: "Tidepool", colors: ["#04141a", "#0e6e6a", "#3dffb0", "#e8ff6a", "#ff4fa3"] },
  { id: "mercury", name: "Mercury temple", colors: ["#101114", "#d7d2c8", "#ff5a36", "#3ec6ff", "#f2c14e"] },
  { id: "bruise", name: "Sweet bruise", colors: ["#1a0d18", "#ff5d8f", "#ffd1a1", "#6d5bff", "#c6ff4a"] },
];

export function paletteById(id: string): Palette {
  return palettes.find((p) => p.id === id) ?? palettes[0]!;
}
