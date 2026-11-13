import type { Experiment, Param } from "./types";

const p = (
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  hint: string,
  integer = false,
): Param => ({ key, label, min, max, step, value, hint, integer });

export const experiments: Experiment[] = [
  {
    id: "polariscope",
    name: "Polariscope",
    principle: "Stress birefringence",
    blurb:
      "A clear plate under tension, seen through crossed polarizers. Color is the order of the stress, not a painted gradient. The black brushes are directions, and they rotate when you turn the polarizer.",
    touch: "Drag to turn the load.",
    periodic: true,
    mode: "webgl",
    cap: 1100,
    parameters: [
      p("holes", "Holes", 1, 6, 1, 4, "Drilled holes. Each one piles stress on its rim.", true),
      p("radius", "Hole radius", 0.028, 0.13, 0.001, 0.062, "Bigger holes crowd the fringe orders together."),
      p("spread", "Spread", 0.08, 0.32, 0.001, 0.18, "How far the holes sit from the center of the plate."),
      p("fringe", "Fringe density", 0.4, 5.5, 0.01, 1.85, "Stress-optic sensitivity. Higher packs more color orders into the same pull."),
      p("polar", "Polarizer", 0, 3.1416, 0.001, 0.55, "Angle of the crossed polarizers. This swings the black isoclinic brushes."),
      p("load", "Load angle", 0, 3.1416, 0.001, 0.15, "Direction of the tension on the plate."),
    ],
  },
  {
    id: "basilica",
    name: "Basilica",
    principle: "Newton basins",
    blurb:
      "Newton's method hunts the roots of a polynomial. Every pixel is a starting guess. The glass color is which root it falls into. The dark lead is the boundary where the guess can fall either way.",
    touch: "Drag to pull the whole constellation of roots.",
    periodic: true,
    mode: "webgl",
    cap: 1000,
    parameters: [
      p("degree", "Roots", 3, 6, 1, 5, "How many roots share the plane. The glass cracks into that many families.", true),
      p("radius", "Orbit", 0.25, 1.25, 0.001, 0.78, "How widely the roots travel. Tight orbits make a dense rose window."),
      p("zoom", "Plate scale", 1.3, 4.2, 0.01, 2.35, "How much of the complex plane is set into the window."),
      p("iter", "Newton steps", 6, 22, 1, 16, "More steps grow finer cames and thinner boundary lace.", true),
      p("twist", "Twist", 0, 1.4, 0.001, 0.42, "Offsets each root so the orbits refuse a regular polygon."),
    ],
  },
  {
    id: "leadlight",
    name: "Leadlight",
    principle: "Tropical soliton web",
    blurb:
      "Periodic phases compete for the pane. The glass is whichever wave is winning, and the lead came is the tie — where two wavefronts are equal and the rest have lost. The cames slide, meet, and hand the pane off.",
    touch: "Drag sideways to pinch the angles.",
    periodic: true,
    mode: "webgl",
    cap: 1100,
    parameters: [
      p("count", "Wavefronts", 3, 7, 1, 6, "How many periodic phases compete. Three is a loose net, seven is filigree.", true),
      p("freq", "Scale", 3, 18, 0.01, 8.5, "How many panes fit across the plate."),
      p("sharp", "Vein weight", 0.4, 6, 0.01, 1.6, "Low is a fat came. High is a hairline crack."),
      p("pinch", "Angle pinch", 0, 1.6, 0.001, 0.62, "Breaks equal spacing so the web is not a kaleidoscope."),
      p("speed", "Drift", 0.6, 3, 0.01, 1, "Whole turns of each wavefront per loop. Locks to an integer so the loop closes."),
    ],
  },
  {
    id: "switchyard",
    name: "Switchyard",
    principle: "Rewiring Truchet tiles",
    blurb:
      "Every cell is two arcs. A traveling rule melts one orientation into the other, so the pipes actually reconnect instead of only scrolling. Bias decides whether the yard is loops or a maze.",
    touch: "Drag to shove the tile rule.",
    periodic: true,
    mode: "webgl",
    cap: 1100,
    parameters: [
      p("scale", "Cell count", 4, 24, 0.01, 9, "Tiles across the plate."),
      p("thick", "Bore", 0.08, 0.42, 0.001, 0.2, "Inner radius of the glass pipe."),
      p("bias", "Rule bias", 0, 1, 0.001, 0.5, "Which orientation wins. The middle is the most tangled."),
      p("morph", "Melt", 0, 1, 0.001, 0.42, "Zero snaps a pipe over. One melts it through the crossing."),
      p("tempo", "Wave tempo", 0.4, 3, 0.01, 1, "How many times the rewiring wave laps the yard per loop."),
    ],
  },
  {
    id: "unmixing",
    name: "Unmixing",
    principle: "Cahn–Hilliard",
    blurb:
      "Two components in one liquid, conserved. They don't paint a pattern and stop — the interface pays a cost, so droplets eat each other and a labyrinth coarsens. Composition decides pearls versus a bicontinuous sponge.",
    touch: "Drag to seed the other component.",
    periodic: false,
    mode: "2d",
    cap: 320,
    parameters: [
      p("epsilon", "Interface", 0.55, 1.7, 0.001, 1.02, "Thickness of the boundary. Thin is lace, thick is pearls."),
      p("mobility", "Mobility", 0.25, 1.5, 0.001, 0.8, "How fast composition can move."),
      p("mean", "Composition", -0.55, 0.55, 0.001, 0.05, "Zero is a labyrinth. Toward either end, droplets of the minority."),
      p("kick", "Thermal kick", 0, 0.35, 0.001, 0.04, "Noise that keeps a finished pearl from dying."),
    ],
  },
  {
    id: "ventricle",
    name: "Ventricle",
    principle: "Stable fluid",
    blurb:
      "Real incompressible ink. Velocity is advected, diffused, and projected back to be divergence-free, then the dye rides it. Vorticity confinement is what makes the eddies refuse to die.",
    touch: "Drag to inject dye and momentum.",
    periodic: false,
    mode: "2d",
    cap: 300,
    parameters: [
      p("viscosity", "Viscosity", 0, 1, 0.001, 0.18, "How quickly momentum smears. Zero stays crisp and wild."),
      p("vorticity", "Vorticity", 0, 14, 0.01, 6, "How hard a spin reinforces itself."),
      p("fade", "Dye life", 0.9, 0.999, 0.001, 0.992, "One is immortal ink. Lower eats the trail."),
      p("stir", "Injectors", 0.2, 3, 0.01, 1.15, "Strength of the three orbiting nozzles, and of your finger."),
    ],
  },
  {
    id: "enamel",
    name: "Enamel",
    principle: "Kinetic Ising",
    blurb:
      "Each tile is a magnet that wants to agree with its neighbors, except temperature keeps flipping them. Below the critical temperature the glaze freezes into continents. At the critical point the continents are fractal.",
    touch: "Drag to force a region into the other glaze.",
    periodic: false,
    mode: "2d",
    cap: 400,
    parameters: [
      p("temp", "Temperature", 0.45, 4.8, 0.001, 2.27, "Critical point is about 2.27. Below: continents. Above: confetti."),
      p("field", "Field", -1.4, 1.4, 0.001, 0, "External field. Pulls every tile toward one glaze."),
      p("anisotropy", "Grain", 0.25, 2.8, 0.001, 1, "Horizontal versus vertical coupling. Stretches domains into grain."),
      p("speed", "Flip rate", 0.05, 1, 0.001, 0.4, "Fraction of tiles that reconsider their glaze each frame."),
    ],
  },
  {
    id: "fulgurite",
    name: "Fulgurite",
    principle: "Dielectric breakdown",
    blurb:
      "A potential is solved across the plate, then a channel grows toward the strongest field and the potential is solved again. Low bias is a bush. High bias is one violent filament. This is captured lightning, not a branching drawing.",
    touch: "Tap to strike a new tree from that point.",
    periodic: false,
    mode: "2d",
    cap: 900,
    parameters: [
      p("eta", "Field bias", 0.35, 3, 0.001, 1.2, "Exponent on the electric field. Higher refuses side branches."),
      p("branch", "Strikes / frame", 1, 5, 1, 2, "How many new segments the discharge adds at once.", true),
      p("relax", "Potential sweeps", 1, 8, 1, 3, "How completely the field settles before the next strike.", true),
      p("thickness", "Channel", 0.4, 2.4, 0.01, 1.1, "Drawn weight of the filament."),
    ],
  },
  {
    id: "coral",
    name: "Brain coral",
    principle: "Differential growth",
    blurb:
      "A closed curve that repels itself and splits whenever an edge stretches. No nutrients, no chemical map — just local pushing and a bending stiffness. That is enough to fold a loop into a brain.",
    touch: "Tap to plant another loop.",
    periodic: false,
    mode: "2d",
    cap: 900,
    parameters: [
      p("repel", "Repulsion", 0.012, 0.07, 0.001, 0.032, "How far a node can feel its neighbors. Wider repulsion makes fatter folds."),
      p("split", "Split length", 0.01, 0.046, 0.001, 0.02, "An edge longer than this grows a new node."),
      p("smooth", "Stiffness", 0.02, 0.48, 0.001, 0.16, "How hard the curve resists bending."),
      p("growth", "Growth", 0.15, 2, 0.01, 0.85, "Step size. High growth buckles faster and can self-intersect."),
    ],
  },
  {
    id: "wormsilk",
    name: "Wormsilk",
    principle: "Least-visit worms",
    blurb:
      "Each worm looks a short distance left, ahead, and right, and turns toward the least-used ground. They don't diffuse a trail. They comb the plate by avoidance, and several species share one memory.",
    touch: "Drag to erase. They rush back into the bare patch.",
    periodic: false,
    mode: "2d",
    cap: 300,
    parameters: [
      p("population", "Worms", 16, 220, 1, 80, "How many are combing at once.", true),
      p("sensor", "Sensor", 2, 16, 0.1, 6.5, "How far ahead they can see used silk."),
      p("fade", "Forget", 0.001, 0.06, 0.001, 0.01, "How fast old silk is forgotten. Slow forget builds velvet."),
      p("species", "Species", 1, 4, 1, 3, "Separate colors sharing one memory of the ground.", true),
      p("jitter", "Jitter", 0, 1, 0.001, 0.22, "Random turn when the sensors tie. Zero is perfectly determined and can stall."),
    ],
  },
  {
    id: "sinai",
    name: "Sinai",
    principle: "Chaotic billiard",
    blurb:
      "Hundreds of rays in a room with a round scatterer. Every bounce is specular. A circular obstacle in a rectangle is a classic chaotic billiard — the nest of light is the orbit itself, kept as a long exposure.",
    touch: "Drag the scatterer.",
    periodic: false,
    mode: "2d",
    cap: 800,
    parameters: [
      p("radius", "Scatterer", 0.04, 0.3, 0.001, 0.13, "Radius of the disk. Larger disks chop the orbits sooner."),
      p("rays", "Rays", 60, 800, 1, 380, "How many trajectories share the exposure.", true),
      p("swirl", "Swirl", 0, 1, 0.001, 0.4, "Tangential part of the launch. Zero is a radial spray."),
      p("fade", "Forget light", 0.02, 0.28, 0.001, 0.07, "How fast the exposure fades. Low is a long exposure."),
      p("wander", "Disk wander", 0, 0.18, 0.001, 0.05, "Orbit of the disk when you are not holding it."),
    ],
  },
  {
    id: "reliquary",
    name: "Reliquary",
    principle: "Span pixel sort",
    blurb:
      "A warped noise field is combed, span by span, wherever it crosses a threshold. The streaks are the sort, not a blur. Axis and threshold change which part of the field is allowed to become thread.",
    touch: "Drag to slide the warp.",
    periodic: true,
    mode: "2d",
    cap: 280,
    parameters: [
      p("freq", "Grain", 1, 7, 0.01, 2.8, "Frequency of the field being sorted."),
      p("warp", "Warp", 0, 2.4, 0.001, 1.05, "How hard a second noise field bends the first before the sort."),
      p("thresh", "Threshold", 0, 0.85, 0.001, 0.22, "Only values above this are combed. Zero sorts every row into a pure gradient."),
      p("axis", "Axis", 0, 2, 1, 0, "0 horizontal, 1 vertical, 2 both — both makes blocks.", true),
      p("octaves", "Octaves", 2, 6, 1, 5, "Detail in the unsorted field. More octaves, finer threads.", true),
    ],
  },
];

export function experimentById(id: string): Experiment {
  return experiments.find((e) => e.id === id) ?? experiments[0]!;
}
