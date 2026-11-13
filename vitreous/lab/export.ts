import { Muxer, ArrayBufferTarget } from "mp4-muxer";

const yieldUI = () => new Promise((r) => setTimeout(r, 0));

export function evenSize(aspect: string, short: number): [number, number] {
  const map: Record<string, [number, number]> = {
    "1:1": [1, 1],
    "4:5": [4, 5],
    "9:16": [9, 16],
    "16:9": [16, 9],
  };
  const [a, b] = map[aspect] ?? [1, 1];
  let w: number;
  let h: number;
  if (a >= b) {
    h = short;
    w = Math.round((short * a) / b);
  } else {
    w = short;
    h = Math.round((short * b) / a);
  }
  w -= w % 2;
  h -= h % 2;
  return [Math.max(2, w), Math.max(2, h)];
}

function medianCut(px: Uint32Array, n: number) {
  const boxes: { s: number; e: number; ch: number; range: number; score: number }[] = [
    { s: 0, e: px.length, ch: 0, range: 0, score: 0 },
  ];
  const info = (b: (typeof boxes)[number]) => {
    let rn = 255, rx = 0, gn = 255, gx = 0, bn = 255, bx = 0;
    for (let i = b.s; i < b.e; i++) {
      const v = px[i]!;
      const r = (v >> 16) & 255, g = (v >> 8) & 255, bb = v & 255;
      if (r < rn) rn = r; if (r > rx) rx = r;
      if (g < gn) gn = g; if (g > gx) gx = g;
      if (bb < bn) bn = bb; if (bb > bx) bx = bb;
    }
    const rr = rx - rn, gr = gx - gn, br = bx - bn;
    b.ch = rr >= gr && rr >= br ? 16 : gr >= br ? 8 : 0;
    b.range = Math.max(rr, gr, br);
    b.score = b.range * Math.sqrt(b.e - b.s);
  };
  info(boxes[0]!);
  while (boxes.length < n) {
    let bi = -1, best = 0;
    boxes.forEach((b, i) => {
      if (b.e - b.s > 1 && b.range > 0 && b.score > best) { best = b.score; bi = i; }
    });
    if (bi < 0) break;
    const b = boxes[bi]!;
    const sh = b.ch;
    px.subarray(b.s, b.e).sort((x, y) => ((x >> sh) & 255) - ((y >> sh) & 255));
    const mid = (b.s + b.e) >> 1;
    const A = { s: b.s, e: mid, ch: 0, range: 0, score: 0 };
    const C = { s: mid, e: b.e, ch: 0, range: 0, score: 0 };
    info(A); info(C);
    boxes.splice(bi, 1, A, C);
  }
  const pal = new Uint8Array(768);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bb = 0;
    for (let j = b.s; j < b.e; j++) {
      const v = px[j]!;
      r += (v >> 16) & 255; g += (v >> 8) & 255; bb += v & 255;
    }
    const c = b.e - b.s || 1;
    pal[i * 3] = r / c; pal[i * 3 + 1] = g / c; pal[i * 3 + 2] = bb / c;
  });
  return pal;
}

function makeNearest(pal: Uint8Array) {
  const cache = new Int16Array(32768).fill(-1);
  return (r: number, g: number, b: number) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = cache[key];
    if (hit !== undefined && hit >= 0) return hit;
    let best = 0, bd = 1e12;
    const rr = (r & 0xf8) | 4, gg = (g & 0xf8) | 4, bb = (b & 0xf8) | 4;
    for (let i = 0; i < 256; i++) {
      const dr = rr - pal[i * 3]!, dg = gg - pal[i * 3 + 1]!, db = bb - pal[i * 3 + 2]!;
      const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (d < bd) { bd = d; best = i; }
    }
    cache[key] = best;
    return best;
  };
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

class ByteOut {
  chunks: Uint8Array[] = [];
  buf = new Uint8Array(1 << 20);
  pos = 0;
  byte(b: number) {
    if (this.pos >= this.buf.length) this.flush();
    this.buf[this.pos++] = b & 255;
  }
  bytes(a: Uint8Array) { for (let i = 0; i < a.length; i++) this.byte(a[i]!); }
  u16(v: number) { this.byte(v & 255); this.byte((v >> 8) & 255); }
  str(s: string) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  flush() {
    if (this.pos) { this.chunks.push(this.buf.slice(0, this.pos)); this.pos = 0; }
  }
  blob(type: string) {
    this.flush();
    const parts: BlobPart[] = this.chunks.map((c) => c.buffer.slice(c.byteOffset, c.byteOffset + c.byteLength) as ArrayBuffer);
    return new Blob(parts, { type });
  }
}

function gifStart(o: ByteOut, W: number, H: number, pal: Uint8Array) {
  o.str("GIF89a"); o.u16(W); o.u16(H); o.byte(0xf7); o.byte(0); o.byte(0); o.bytes(pal);
  o.byte(0x21); o.byte(0xff); o.byte(11); o.str("NETSCAPE2.0"); o.byte(3); o.byte(1); o.u16(0); o.byte(0);
}

function gifFrame(out: ByteOut, W: number, H: number, idx: Uint8Array, delayCs: number) {
  out.byte(0x21); out.byte(0xf9); out.byte(4); out.byte(0x04); out.u16(delayCs); out.byte(0); out.byte(0);
  out.byte(0x2c); out.u16(0); out.u16(0); out.u16(W); out.u16(H); out.byte(0); out.byte(8);
  let cs = 9, next = 258, cur = 0, bits = 0;
  const blk = new Uint8Array(255);
  let bl = 0;
  const dict = new Map<number, number>();
  const emit = (code: number) => {
    cur |= code << bits; bits += cs;
    while (bits >= 8) {
      blk[bl++] = cur & 255; cur >>>= 8; bits -= 8;
      if (bl === 255) { out.byte(255); out.bytes(blk); bl = 0; }
    }
  };
  emit(256);
  let pre = idx[0] ?? 0;
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i]!;
    const key = pre * 256 + k;
    const c = dict.get(key);
    if (c !== undefined) { pre = c; continue; }
    emit(pre);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << cs) && cs < 12) cs++;
    } else {
      emit(256); dict.clear(); cs = 9; next = 258;
    }
    pre = k;
  }
  emit(pre); emit(257);
  if (bits > 0) {
    blk[bl++] = cur & 255;
    if (bl === 255) { out.byte(255); out.bytes(blk); bl = 0; }
  }
  if (bl) { out.byte(bl); out.bytes(blk.subarray(0, bl)); }
  out.byte(0);
}

export async function encodeGif(
  W: number, H: number, fps: number, N: number,
  frame: (i: number) => void,
  grab: HTMLCanvasElement,
  onProg: (f: number, text: string) => void,
) {
  const g = grab.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("Could not read frames.");
  const stride = Math.max(1, Math.floor((W * H) / 8000));
  const K = Math.min(N, 8);
  const samples = new Uint32Array(K * Math.ceil((W * H) / stride));
  let si = 0;
  for (let k = 0; k < K; k++) {
    frame(Math.floor((k * N) / K));
    const d = g.getImageData(0, 0, W, H).data;
    for (let p = 0; p < W * H && si < samples.length; p += stride) {
      const o = p * 4;
      samples[si++] = ((d[o] ?? 0) << 16) | ((d[o + 1] ?? 0) << 8) | (d[o + 2] ?? 0);
    }
    onProg(k / K * 0.12, "Reading color");
    await yieldUI();
  }
  const pal = medianCut(samples.subarray(0, si), 256);
  const near = makeNearest(pal);
  const out = new ByteOut();
  gifStart(out, W, H, pal);
  const delay = Math.max(2, Math.round(100 / fps));
  const idx = new Uint8Array(W * H);
  for (let i = 0; i < N; i++) {
    frame(i);
    const d = g.getImageData(0, 0, W, H).data;
    for (let y = 0, p = 0; y < H; y++) {
      for (let x = 0; x < W; x++, p++) {
        const o = p * 4;
        const t = (BAYER[((y & 3) * 4 + (x & 3)) % 16]! - 7.5) * 4;
        const r = Math.max(0, Math.min(255, (d[o] ?? 0) + t));
        const gg = Math.max(0, Math.min(255, (d[o + 1] ?? 0) + t));
        const b = Math.max(0, Math.min(255, (d[o + 2] ?? 0) + t));
        idx[p] = near(r, gg, b);
      }
    }
    gifFrame(out, W, H, idx, delay);
    if (i % 2 === 0) {
      onProg(0.12 + ((i + 1) / N) * 0.88, `Frame ${i + 1} / ${N}`);
      await yieldUI();
    }
  }
  out.byte(0x3b);
  return out.blob("image/gif");
}

export async function encodeMp4(
  W: number, H: number, fps: number, N: number,
  frame: (i: number) => void,
  grab: HTMLCanvasElement,
  onProg: (f: number, text: string) => void,
) {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") {
    throw new Error("This browser has no frame-accurate MP4 encoder. Switch the format to GIF.");
  }
  const codecs = ["avc1.640028", "avc1.4d0034", "avc1.42001f", "avc1.42001e"];
  let cfg: VideoEncoderConfig | null = null;
  for (const codec of codecs) {
    const c: VideoEncoderConfig = {
      codec, width: W, height: H,
      bitrate: Math.round(Math.min(16e6, W * H * fps * 0.28)),
      framerate: fps,
    };
    try {
      if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; }
    } catch { /* try the next profile */ }
  }
  if (!cfg) throw new Error("H.264 isn't available here. Switch the format to GIF.");
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: W, height: H, frameRate: fps },
    fastStart: "in-memory",
  });
  let err: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { err = e; },
  });
  enc.configure(cfg);
  for (let j = 0; j < N; j++) {
    frame(j);
    const vf = new VideoFrame(grab, { timestamp: Math.round((j * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: j % (fps * 2) === 0 });
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 4));
    if (err) throw err;
    if (j % 2 === 0) {
      onProg(j / N, `Frame ${j + 1} / ${N}`);
      await yieldUI();
    }
  }
  await enc.flush();
  if (err) throw err;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
