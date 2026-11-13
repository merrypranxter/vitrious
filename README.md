# VITREOUS — The Living Materials Laboratory

Twelve distinct computational materials, preserved from the `vitreous` branch of [JAVASHITS](https://github.com/merrypranxter/javashits/tree/vitreous/vitreous). Live mathematical experiments, not pre-rendered effects.

**The twelve engines:** Polariscope (stress birefringence), Basilica (Newton basins), Leadlight (tropical soliton web), Switchyard (rewiring Truchet), Unmixing (Cahn–Hilliard), Ventricle (stable fluids), Enamel (kinetic Ising), Fulgurite (dielectric breakdown), Brain coral (differential growth), Wormsilk (least-visit agents), Sinai (chaotic billiard), Reliquary (span sorting).

## Open on Netlify

1. In Netlify select **Add new project → Import an existing project**.
2. Pick GitHub repository `merrypranxter/vitrious` and branch `main`.
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Click Deploy. No external services, backend, or API keys are needed.

The included `netlify.toml` also sets build/publish defaults. This is separate from the original JAVASHITS.

## Run locally

Requires Node 22+. `npm install`, `npm run dev`.

**Controls:** touch/drag the art, Mutate, Reseed, parameter sliders, palettes, export PNG/GIF/MP4 (browser permitting). The 5 analytic mechanisms have phase-periodic loops; simulations continue evolving, so they produce clips rather than perfect loops. Verify mobile export performance on a physical iPhone.

### Preservation

The 12 original engines are copied without changes into `vitreous/lab/`. This repository adds the app entry point, Tailwind theme, package manifest and Netlify config. It does not replace any mathematical mechanism with a visual filter.
