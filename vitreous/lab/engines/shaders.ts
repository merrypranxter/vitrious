import { hexToRgb, type RGB } from "../color";
import { PAL, compile, getGL, locs, makeQuad, type GL } from "../glkit";
import type { Engine, PointerState } from "../types";

const HEADER = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTau;
uniform float uSeed;
${PAL}
`;

const POLARISCOPE = `${HEADER}
uniform float uHoles, uRadius, uSpread, uFringe, uPolar, uLoad;
void kirsch(vec2 d, float a, float beta, out float sx, out float sy, out float tau) {
  float r2 = dot(d, d);
  float r = sqrt(r2);
  float inv = (a * a) / r2;
  float inv2 = inv * inv;
  float cb = cos(beta), sb = sin(beta);
  float xl = d.x * cb + d.y * sb;
  float yl = -d.x * sb + d.y * cb;
  float c2 = (xl * xl - yl * yl) / r2;
  float s2 = (2.0 * xl * yl) / r2;
  float srr = 0.5 * (1.0 - inv) + 0.5 * (1.0 - 4.0 * inv + 3.0 * inv2) * c2;
  float stt = 0.5 * (1.0 + inv) - 0.5 * (1.0 + 3.0 * inv2) * c2;
  float srt = -0.5 * (1.0 + 2.0 * inv - 3.0 * inv2) * s2;
  float ct = xl / r;
  float st = yl / r;
  float ct2 = ct * ct;
  float st2 = st * st;
  float sxy = 2.0 * ct * st;
  float sxL = srr * ct2 + stt * st2 - srt * sxy;
  float syL = srr * st2 + stt * ct2 + srt * sxy;
  float tL = (srr - stt) * ct * st + srt * (ct2 - st2);
  float c2b = cb * cb, s2b = sb * sb, cs = cb * sb;
  sx = c2b * sxL + s2b * syL - 2.0 * cs * tL;
  sy = s2b * sxL + c2b * syL + 2.0 * cs * tL;
  tau = cs * (sxL - syL) + (c2b - s2b) * tL;
}
void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float plate = smoothstep(0.5, 0.478, length(p));
  float beta = uLoad;
  float cb = cos(beta), sb = sin(beta);
  float fx = cb * cb, fy = sb * sb, ft = cb * sb;
  float sx = fx, sy = fy, tau = ft;
  float hole = 0.0;
  float rim = 0.0;
  int N = int(uHoles + 0.5);
  float a = uRadius;
  for (int i = 0; i < 6; i++) {
    if (i >= N) break;
    float fi = float(i);
    float ang = 6.28318530718 * (fi / float(N)) + uSeed;
    float wob = 0.045 * sin(6.28318530718 * (uTau * float(1 + (i - (i / 2) * 2)) + fi * 0.17));
    vec2 c = vec2(cos(ang), sin(ang)) * uSpread + vec2(wob, wob * 0.6);
    vec2 d = p - c;
    float r = length(d);
    float edge = smoothstep(a + 0.01, a, r);
    hole = max(hole, smoothstep(a + 0.004, a - 0.002, r));
    rim = max(rim, exp(-pow(abs(r - a) / 0.012, 2.0)));
    if (r > a * 1.02) {
      float ksx, ksy, kt;
      kirsch(d, a, beta, ksx, ksy, kt);
      sx += ksx - fx;
      sy += ksy - fy;
      tau += kt - ft;
    }
  }
  float diff = sqrt((sx - sy) * (sx - sy) + 4.0 * tau * tau);
  float angp = 0.5 * atan(2.0 * tau, sx - sy);
  float iso = sin(2.0 * (angp - uPolar));
  iso = 0.2 + 0.8 * iso * iso;
  vec3 col = vec3(0.0);
  float acc = 0.0;
  for (int k = 0; k < 5; k++) {
    float lam = 0.68 + float(k) * 0.14;
    float s = sin(3.14159265 * diff * uFringe / lam);
    float I = s * s * iso;
    vec3 pk = k == 0 ? uP1 : k == 1 ? uP2 : k == 2 ? uP3 : k == 3 ? uP4 : uP2;
    col += pk * I;
    acc += I;
  }
  col = col / (0.28 + acc * 0.1);
  col *= plate * 1.15;
  col = mix(col, vec3(0.015, 0.016, 0.02), hole * plate);
  col += pal(0.72) * rim * (1.0 - hole) * 0.7;
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.02 * plate;
  col = col / (1.0 + col * 0.08);
  fragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

const BASILICA = `${HEADER}
uniform float uDegree, uRadius, uZoom, uIter, uTwist, uGrabOn;
uniform vec2 uGrab;
vec2 cinv(vec2 a) {
  float m = dot(a, a) + 1e-8;
  return vec2(a.x, -a.y) / m;
}
void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 z0 = (vUv - 0.5) * vec2(aspect, 1.0) * uZoom;
  int deg = int(uDegree + 0.5);
  vec2 roots[6];
  roots[0] = vec2(0.2); roots[1] = vec2(-0.2); roots[2] = vec2(0.0, 0.2);
  roots[3] = vec2(0.0, -0.2); roots[4] = vec2(0.3, 0.1); roots[5] = vec2(-0.3, -0.1);
  for (int i = 0; i < 6; i++) {
    if (i >= deg) break;
    float fi = float(i);
    float dir = float(1 - (i - (i / 2) * 2) * 2);
    float a = 6.28318530718 * (fi / float(deg) + uTau * dir) + uTwist * fi + uSeed;
    float rad = uRadius * (0.62 + 0.38 * sin(fi * 1.7 + uSeed));
    roots[i] = vec2(cos(a), sin(a)) * rad;
    if (uGrabOn > 0.5) {
      vec2 g = (uGrab - 0.5) * vec2(aspect, 1.0) * uZoom;
      roots[i] += (g - roots[i]) * exp(-length(g - roots[i]) * 1.6) * 0.9;
    }
  }
  vec2 z = z0;
  int maxIt = int(uIter + 0.5);
  float steps = float(maxIt);
  float winner = 0.0;
  for (int it = 0; it < 24; it++) {
    if (it >= maxIt) break;
    vec2 sum = vec2(0.0);
    float nearest = 1e9;
    float nearId = 0.0;
    for (int k = 0; k < 6; k++) {
      if (k >= deg) break;
      vec2 d = z - roots[k];
      float m = dot(d, d);
      float dist = sqrt(m);
      if (dist < nearest) { nearest = dist; nearId = float(k); }
      sum += vec2(d.x, -d.y) / (m + 1e-5);
    }
    if (nearest < 0.018) { winner = nearId; steps = float(it); break; }
    vec2 stepv = cinv(sum);
    float sl = length(stepv);
    if (sl > 0.62) stepv *= 0.62 / sl;
    z -= stepv;
    winner = nearId;
    steps = float(it);
  }
  float near0 = 1e9;
  for (int k = 0; k < 6; k++) {
    if (k >= deg) break;
    near0 = min(near0, length(z0 - roots[k]));
  }
  float id = winner;
  float bands = sin(steps * 1.35 + near0 * 6.0);
  vec3 glass = pal(fract(0.06 + id / float(deg) + 0.045 * bands));
  float shade = 0.42 + 0.7 * (0.5 + 0.5 * bands);
  float edge = smoothstep(0.08, 0.9, fwidth(id) * 5.0);
  float ring = smoothstep(0.35, 1.4, fwidth(steps) * 2.2);
  vec3 col = glass * shade;
  col = mix(col, vec3(0.02, 0.016, 0.02), clamp(edge, 0.0, 1.0));
  col += vec3(0.96, 0.93, 0.86) * pow(clamp(edge, 0.0, 1.0), 2.0) * 0.55;
  col += pal(fract(0.55 + id / float(deg))) * ring * 0.35;
  float jewel = exp(-near0 * near0 * 70.0);
  col += pal(0.92) * jewel * 1.15;
  fragColor = vec4(col / (1.0 + col * 0.12), 1.0);
}
`;

const LEADLIGHT = `${HEADER}
uniform float uCount, uFreq, uSharp, uPinch, uSpeed;
void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  int N = int(uCount + 0.5);
  float n = float(max(N, 1));
  float top = -2.0;
  float second = -2.0;
  float third = -2.0;
  float idTop = 0.0;
  float idSecond = 1.0;
  float turns = max(1.0, floor(uSpeed + 0.5));
  for (int i = 0; i < 7; i++) {
    if (i >= N) break;
    float fi = float(i);
    float ang = (fi + uPinch * fi * 0.31) * 6.28318530718 / n + 0.37;
    vec2 dir = vec2(cos(ang), sin(ang));
    float sgn = float(1 - (i - (i / 2) * 2) * 2);
    float harm = 1.0 + float(i - (i / 2) * 2);
    float e = cos(uFreq * dot(p, dir) + sgn * harm * turns * uTau * 6.28318530718 + uSeed * fi * 0.17);
    if (e > top) {
      third = second;
      second = top;
      idSecond = idTop;
      top = e;
      idTop = fi;
    } else if (e > second) {
      third = second;
      second = e;
      idSecond = fi;
    } else if (e > third) {
      third = e;
    }
  }
  float gap = top - second;
  float yGap = max(second - third, 0.0);
  float tube = exp(-gap * gap * max(uSharp, 0.4) * 28.0);
  vec3 pane = pal(fract(0.04 + idTop / n));
  pane *= 0.62 + 0.4 * smoothstep(0.02, 0.35, gap);
  vec3 lead = mix(vec3(0.98, 0.96, 0.9), pal(fract(0.72 + idSecond / n)), 0.28);
  float junction = exp(-(gap * gap + yGap * yGap) * max(uSharp, 0.4) * 18.0);
  vec3 col = mix(pane, lead, clamp(tube, 0.0, 1.0));
  col += vec3(1.0, 0.98, 0.94) * junction * 0.85;
  fragColor = vec4(col, 1.0);
}
`;

const SWITCHYARD = `${HEADER}
uniform float uScale, uThick, uBias, uMorph, uTempo;
float hash(vec2 q) {
  return fract(sin(dot(q, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
}
float pair(vec2 f) {
  float d1 = abs(length(f) - 0.5);
  float d2 = abs(length(f - 1.0) - 0.5);
  return min(d1, d2);
}
void main() {
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 g = vUv * vec2(uScale * aspect, uScale);
  vec2 id = floor(g);
  vec2 f = fract(g);
  float n = hash(id);
  float wave = 0.5 + 0.5 * sin(6.28318530718 * (uTau * uTempo) + n * 6.28318530718 + id.x * 0.13);
  float edge = max(uMorph, 0.02);
  float k = smoothstep(0.5 - edge * 0.5, 0.5 + edge * 0.5, fract(n * 7.13 + uBias + wave));
  float dA = pair(f);
  float dB = pair(vec2(f.x, 1.0 - f.y));
  float d = mix(dA, dB, k);
  float aa = max(fwidth(d) * 1.25, 0.0012);
  float mask = smoothstep(uThick + aa, uThick - aa, d);
  float nd = clamp(d / max(uThick, 0.001), 0.0, 1.0);
  float light = sqrt(max(0.0, 1.0 - nd * nd));
  float spec = pow(light, 18.0) * mask;
  vec3 glass = pal(fract(0.16 + n * 3.7 + 0.05 * k));
  vec3 col = pal(0.0) * 0.22;
  col = mix(col, glass * (0.2 + light), mask);
  col += vec3(1.0, 0.97, 0.92) * spec * 0.8;
  fragColor = vec4(col, 1.0);
}
`;

type Kind = "polariscope" | "basilica" | "leadlight" | "switchyard";

const FS: Record<Kind, string> = {
  polariscope: POLARISCOPE,
  basilica: BASILICA,
  leadlight: LEADLIGHT,
  switchyard: SWITCHYARD,
};

const UNIFORMS = [
  "uRes", "uTau", "uSeed", "uP0", "uP1", "uP2", "uP3", "uP4",
  "uHoles", "uRadius", "uSpread", "uFringe", "uPolar", "uLoad",
  "uDegree", "uZoom", "uIter", "uTwist", "uGrabOn", "uGrab",
  "uCount", "uFreq", "uSharp", "uPinch", "uSpeed",
  "uScale", "uThick", "uBias", "uMorph", "uTempo",
];

export function createShaderEngine(kind: Kind, seed: number): Engine {
  let gl: GL | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let prog: WebGLProgram | null = null;
  let quad: ReturnType<typeof makeQuad> | null = null;
  let L: Record<string, WebGLUniformLocation | null> = {};
  let params: Record<string, number> = {};
  let colors: RGB[] = [];
  let pointer: PointerState = { u: 0.5, v: 0.5, down: false, dx: 0, dy: 0 };
  let drag = 0;
  let grab = false;
  let was = false;
  const seed01 = (seed % 1000) / 1000;

  function draw(phase: number) {
    if (!gl || !prog || !quad || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    gl.viewport(0, 0, w, h);
    gl.useProgram(prog);
    gl.uniform2f(L.uRes!, w, h);
    gl.uniform1f(L.uTau!, phase);
    gl.uniform1f(L.uSeed!, seed01 * 6.28318);
    const names = ["uP0", "uP1", "uP2", "uP3", "uP4"] as const;
    for (let i = 0; i < 5; i++) {
      const c = colors[Math.min(i, colors.length - 1)] ?? [1, 1, 1];
      gl.uniform3f(L[names[i]]!, c[0], c[1], c[2]);
    }
    if (kind === "polariscope") {
      gl.uniform1f(L.uHoles!, params.holes ?? 4);
      gl.uniform1f(L.uRadius!, params.radius ?? 0.06);
      gl.uniform1f(L.uSpread!, params.spread ?? 0.18);
      gl.uniform1f(L.uFringe!, params.fringe ?? 1.8);
      gl.uniform1f(L.uPolar!, params.polar ?? 0.5);
      gl.uniform1f(L.uLoad!, (params.load ?? 0) + drag);
    } else if (kind === "basilica") {
      gl.uniform1f(L.uDegree!, params.degree ?? 5);
      gl.uniform1f(L.uRadius!, params.radius ?? 0.7);
      gl.uniform1f(L.uZoom!, params.zoom ?? 2.3);
      gl.uniform1f(L.uIter!, params.iter ?? 12);
      gl.uniform1f(L.uTwist!, params.twist ?? 0.4);
      gl.uniform1f(L.uGrabOn!, grab ? 1 : 0);
      gl.uniform2f(L.uGrab!, pointer.u, 1 - pointer.v);
    } else if (kind === "leadlight") {
      gl.uniform1f(L.uCount!, params.count ?? 5);
      gl.uniform1f(L.uFreq!, params.freq ?? 8);
      gl.uniform1f(L.uSharp!, params.sharp ?? 12);
      gl.uniform1f(L.uPinch!, (params.pinch ?? 0.6) + drag);
      gl.uniform1f(L.uSpeed!, params.speed ?? 1);
    } else {
      gl.uniform1f(L.uScale!, params.scale ?? 9);
      gl.uniform1f(L.uThick!, params.thick ?? 0.2);
      gl.uniform1f(L.uBias!, (params.bias ?? 0.5) + drag);
      gl.uniform1f(L.uMorph!, params.morph ?? 0.4);
      gl.uniform1f(L.uTempo!, params.tempo ?? 1);
    }
    quad.draw();
  }

  return {
    periodic: true,
    mount(c) {
      canvas = c;
      gl = getGL(c);
      prog = compile(gl, FS[kind]);
      L = locs(gl, prog, UNIFORMS);
      quad = makeQuad(gl);
    },
    setBitmap(w, h) {
      if (!canvas) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    },
    setParams(p) { params = p; },
    setPalette(hex) { colors = hex.map(hexToRgb); },
    setPointer(s) {
      pointer = s;
      if (s.down) {
        if (kind === "polariscope") drag += s.dx * 2.4;
        else if (kind === "leadlight") drag += s.dx * 1.4;
        else if (kind === "switchyard") drag += s.dx * 0.8;
        else grab = true;
      }
      if (!s.down && was && kind === "basilica") grab = false;
      was = s.down;
    },
    frame(phase) { draw(phase); },
    reset() { drag = 0; grab = false; },
    destroy() {
      if (gl && prog) gl.deleteProgram(prog);
      quad?.destroy();
      prog = null;
      quad = null;
      gl = null;
    },
  };
}
