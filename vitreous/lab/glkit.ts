export type GL = WebGL2RenderingContext;

const VERT = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const PAL = `
uniform vec3 uP0, uP1, uP2, uP3, uP4;
vec3 pal(float t) {
  t = clamp(t, 0.0, 0.9999);
  float x = t * 4.0;
  float i = floor(x);
  float f = x - i;
  f = f * f * (3.0 - 2.0 * f);
  vec3 a = uP0; vec3 b = uP1;
  if (i > 0.5) { a = uP1; b = uP2; }
  if (i > 1.5) { a = uP2; b = uP3; }
  if (i > 2.5) { a = uP3; b = uP4; }
  return mix(a, b, f);
}
`;

export function getGL(canvas: HTMLCanvasElement): GL {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("This material needs WebGL2, and this device didn't provide it.");
  return gl;
}

export function compile(gl: GL, fs: string): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create a shader program.");
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, fs],
  ] as const) {
    const sh = gl.createShader(type);
    if (!sh) throw new Error("Could not create a shader.");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || "shader compile failed";
      gl.deleteShader(sh);
      throw new Error(log);
    }
    gl.attachShader(program, sh);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "shader link failed");
  }
  return program;
}

export function makeQuad(gl: GL) {
  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  if (!vao || !buf) throw new Error("Could not allocate a quad.");
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return {
    draw() {
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    destroy() {
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
    },
  };
}

export function locs(gl: GL, prog: WebGLProgram, names: string[]) {
  const o: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) o[n] = gl.getUniformLocation(prog, n);
  return o;
}
