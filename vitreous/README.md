# VITREOUS

Twelve materials, twelve mechanisms. Not palette variants of one shader.

The plate stays large. Drag it. The controls underneath change the actual rule, not a coat of color. Hide the bench when you want only the plate. Mutate stays inside a regime so a random draw does not collapse into noise.

Space pauses. M mutates. H hides the bench. Arrow keys change materials.

## The twelve

| Material | What is actually computed | Loop |
| --- | --- | --- |
| Polariscope | Kirsch stress around holes, seen through crossed polarizers. Color is the fringe order. | Exact |
| Basilica | Newton basins of a moving-root polynomial. Glass is which root wins. Lead is the boundary. | Exact |
| Leadlight | Tropical competition of periodic phases. A pane is the winning wave. A came is a tie. | Exact, whole turns |
| Switchyard | Truchet quarter-circles that melt from one orientation into the other and reconnect. | Exact |
| Unmixing | Cahn–Hilliard, conserved, semi-implicit in Fourier space. Droplets eat each other. | Has memory |
| Ventricle | Stam stable fluids. Advect, project, vorticity confinement, three nozzles. | Has memory |
| Enamel | Kinetic Ising near the critical temperature, with a grain direction. | Has memory |
| Fulgurite | Dielectric breakdown. The channel grows into the solved potential, then the field is solved again. | Has memory |
| Brain coral | Differential growth. A closed curve repels itself and splits when an edge stretches. | Has memory |
| Wormsilk | Least-visit worms. They do not diffuse a trail. They comb shared memory. | Has memory |
| Sinai | Specular rays in a rectangle with one moving disk. The picture is the long exposure of a chaotic billiard. | Has memory |
| Reliquary | Domain-warped noise, then span-sorted wherever it crosses a threshold. | Exact |

Simulations are reseeded for export. They will not seam. The looping five are pure functions of phase, so GIF and MP4 close. GIF still quantizes; MP4 is the honest moving copy. Loop length is the tempo. Shapes are 1:1, 4:5, 9:16, 16:9.

Palettes: Carnival glass, Bile lamp, Magma pearl, Tidepool, Mercury temple, Sweet bruise.

Recipes copy into the query string: `m`, `p`, `s`, and each parameter.

## Where the code is

`src/lab/` is the instrument. Analytic materials are WebGL2 fragment shaders. The stateful ones are explicit simulations shaded on a canvas. One stage, two canvases, never two contexts on the same element.
