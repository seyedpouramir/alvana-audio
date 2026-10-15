// Alvana Audio · a small DSP kit for the synthesized effects (48 kHz float; mono = Float32Array, stereo = [L, R]).
// Everything is deterministic: reseed(n) before a recipe and the same code always renders the same file.
import fs from "node:fs";

export const SR = 48000;
export const TAU = Math.PI * 2;

// ---------- random (xorshift32)
let S = 1;
export const reseed = (s) => { S = Math.imul((s | 0) + 1, 2654435761) >>> 0 || 1; };
export const rnd = () => { let x = S; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; S = x; return x / 4294967296; };
export const rr = (a, b) => a + (b - a) * rnd();

export const len = (s) => Math.max(1, Math.round(s * SR));
export const buf = (s) => new Float32Array(len(s));
export const sbuf = (s) => [buf(s), buf(s)];
export const secs = (b) => (Array.isArray(b) ? b[0].length : b.length) / SR;

// ---------- noise
export const white = (s) => { const b = buf(s); for (let i = 0; i < b.length; i++) b[i] = rnd() * 2 - 1; return b; };
export const pink = (s) => {
  const b = buf(s);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < b.length; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    b[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
};
export const brown = (s) => { const b = buf(s); let y = 0; for (let i = 0; i < b.length; i++) { y = (y + 0.02 * (rnd() * 2 - 1)) / 1.02; b[i] = y * 3.5; } return b; };

// ---------- oscillators: f in Hz or (seconds) => Hz; saw and square are band-limited (polyBLEP)
const blep = (t, dt) => {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
};
export function osc(s, f, type = "sine", ph = 0) {
  const b = buf(s);
  for (let i = 0; i < b.length; i++) {
    const fr = typeof f === "function" ? f(i / SR) : f;
    const dt = Math.min(0.49, Math.max(1e-7, fr / SR));
    const p = ph - Math.floor(ph);
    let v;
    if (type === "sine") v = Math.sin(TAU * p);
    else if (type === "tri") v = 4 * Math.abs(p - 0.5) - 1;
    else if (type === "saw") v = 2 * p - 1 - blep(p, dt);
    else v = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep((p + 0.5) % 1, dt);
    b[i] = v;
    ph += dt;
  }
  return b;
}

// ---------- shaping and mixing
export const shape = (b, fn) => { const n = b.length; for (let i = 0; i < n; i++) b[i] *= fn(i / n, i / SR); return b; };
export const decay = (b, tau, atk = 0.002) => shape(b, (_, t) => Math.min(1, t / atk) * Math.exp(-t / tau));
export const fades = (b, a = 0.002, z = 0.01) => {
  const n = b.length, A = Math.min(n, len(a)), Z = Math.min(n, len(z));
  for (let i = 0; i < A; i++) b[i] *= i / A;
  for (let i = 0; i < Z; i++) b[n - 1 - i] *= i / Z;
  return b;
};
export function mix(d, s, at = 0, g = 1) {
  const o = Math.round(at * SR);
  for (let i = 0; i < s.length; i++) { const j = o + i; if (j >= 0 && j < d.length) d[j] += s[i] * g; }
  return d;
}
export const smix = (D, Sx, at = 0, g = 1) => { mix(D[0], Sx[0], at, g); mix(D[1], Sx[1], at, g); return D; };
export const gain = (b, g) => { for (let i = 0; i < b.length; i++) b[i] *= g; return b; };
export const sat = (b, drive = 1.5) => { const k = Math.tanh(drive); for (let i = 0; i < b.length; i++) b[i] = Math.tanh(b[i] * drive) / k; return b; };
export const rms = (b) => { let s = 0; for (const v of b) s += v * v; return Math.sqrt(s / Math.max(1, b.length)); };
/** scale to RMS 1, so layers can be balanced with plain gains */
export const unit = (b) => gain(b, 1 / (rms(b) || 1));
export const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const expl = (a, b, t) => a * Math.pow(b / a, Math.max(0, Math.min(1, t)));
export const rev = (b) => b.slice().reverse();
export const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- biquad (RBJ cookbook); fc and q may be numbers or (sampleIndex) => value
export function biquad(x, type, fc, q = 0.707, dbGain = 0) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const set = (i) => {
    const f = Math.min(SR * 0.45, Math.max(10, typeof fc === "function" ? fc(i) : fc));
    const Q = Math.max(0.1, typeof q === "function" ? q(i) : q);
    const w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * Q);
    let B0, B1, B2, A0, A1, A2;
    if (type === "lp") { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === "hp") { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else if (type === "bp") { B0 = al; B1 = 0; B2 = -al; A0 = 1 + al; A1 = -2 * c; A2 = 1 - al; }
    else { const A = 10 ** (dbGain / 40); B0 = 1 + al * A; B1 = -2 * c; B2 = 1 - al * A; A0 = 1 + al / A; A1 = -2 * c; A2 = 1 - al / A; }
    b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = A1 / A0; a2 = A2 / A0;
  };
  for (let i = 0; i < x.length; i++) {
    if ((i & 15) === 0) set(i);
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
export const lp = (x, fc, q) => biquad(x, "lp", fc, q);
export const hp = (x, fc, q) => biquad(x, "hp", fc, q);
export const bp = (x, fc, q) => biquad(x, "bp", fc, q);
export const eq = (x, fc, q, db) => biquad(x, "peak", fc, q, db);

/** modal synthesis: [[Hz, amp, decay seconds], …] — bells, metal, coins, clicks */
export function modes(s, list, atk = 0.0005) {
  const b = buf(s);
  for (const [f, a, tau] of list) mix(b, decay(osc(s, f, "sine", rnd()), tau, atk), 0, a);
  return b;
}

// ---------- stereo
/** equal-power pan; p in −1..1 or (progress 0..1) => −1..1 */
export function pan(m, p = 0) {
  const n = m.length, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = typeof p === "function" ? p(i / n) : p;
    const a = ((Math.max(-1, Math.min(1, v)) + 1) * Math.PI) / 4;
    L[i] = m[i] * Math.cos(a);
    R[i] = m[i] * Math.sin(a);
  }
  return [L, R];
}

// ---------- FFT convolution reverb
const TW = new Map();
function table(N) {
  if (!TW.has(N)) {
    const c = new Float64Array(N / 2), s = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) { c[k] = Math.cos((2 * Math.PI * k) / N); s[k] = Math.sin((2 * Math.PI * k) / N); }
    TW.set(N, [c, s]);
  }
  return TW.get(N);
}
function fft(re, im, inv) {
  const n = re.length, [C, Sn] = table(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1, step = n / size;
    for (let st = 0; st < n; st += size) {
      for (let k = 0; k < half; k++) {
        const wr = C[k * step], wi = inv ? Sn[k * step] : -Sn[k * step];
        const a = st + k, b = a + half;
        const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
export function convolve(x, h) {
  const n = x.length + h.length - 1;
  let N = 1;
  while (N < n) N <<= 1;
  const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
  ar.set(x); br.set(h);
  fft(ar, ai, false); fft(br, bi, false);
  for (let i = 0; i < N; i++) { const r = ar[i] * br[i] - ai[i] * bi[i], m = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; ai[i] = m; }
  fft(ar, ai, true);
  return Float32Array.from(ar.subarray(0, n));
}
/** stereo impulse response: early reflections + a noise tail that falls 60 dB in rt seconds and darkens as it decays */
export function ir(rt = 1.2, { pre = 0.012, damp = 1, bright = 7000, er = 0.3 } = {}) {
  const n = len(rt * 1.05 + pre), p0 = len(pre);
  const one = () => {
    const h = new Float32Array(n);
    for (let k = 0; k < 10; k++) { const t = p0 + len(rr(0.002, 0.05)); if (t < n) h[t] += er * rr(0.3, 1) * (rnd() < 0.5 ? -1 : 1); }
    let y = 0;
    for (let i = p0; i < n; i++) {
      const t = (i - p0) / SR, e = Math.exp((-6.9078 * t) / rt);
      const fc = bright * Math.exp(-t * damp * 2.2) + 500, a = 1 - Math.exp((-TAU * fc) / SR);
      y += a * (rnd() * 2 - 1 - y);
      h[i] += y * e;
    }
    let en = 0;
    for (const v of h) en += v * v;
    return gain(h, 1 / Math.sqrt(en || 1)); // unit energy: wet = energy ratio of the tail to the dry sound
  };
  return [one(), one()];
}
/** dry + wet; input mono or stereo, output stereo with the tail appended */
export function reverb(x, wet = 0.2, rt = 1.2, opt = {}) {
  const [L, R] = Array.isArray(x) ? x : pan(x, 0);
  if (wet <= 0) return [L, R];
  const [hL, hR] = ir(rt, opt);
  const k = wet;
  const eL = convolve(L, hL), eR = convolve(R, hR);
  for (let i = 0; i < L.length; i++) { eL[i] = eL[i] * k + L[i]; eR[i] = eR[i] * k + R[i]; }
  for (let i = L.length; i < eL.length; i++) { eL[i] *= k; eR[i] *= k; }
  return [eL, eR];
}

/** seamless loop: the extra `xf` seconds at the end are cross-faded into the start */
export function loopify(m, xf) {
  const X = len(xf), L = m.length - X, o = m.slice(0, L);
  for (let i = 0; i < X; i++) { const g = i / X; o[i] = m[i] * Math.sqrt(g) + m[L + i] * Math.sqrt(1 - g); }
  return o;
}

// ---------- output
export function normPeak(x, pk = 0.89) {
  const ch = Array.isArray(x) ? x : [x];
  let m = 0;
  for (const c of ch) for (const v of c) m = Math.max(m, Math.abs(v));
  if (m) for (const c of ch) for (let i = 0; i < c.length; i++) c[i] *= pk / m;
  return x;
}
export function writeWav(file, x, sr = SR) {
  const ch = Array.isArray(x) ? x : [x], n = ch[0].length, C = ch.length;
  const d = Buffer.alloc(n * C * 2);
  for (let i = 0; i < n; i++) for (let c = 0; c < C; c++) d.writeInt16LE(Math.round(Math.max(-1, Math.min(1, ch[c][i])) * 32767), (i * C + c) * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + d.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(C, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * C * 2, 28); h.writeUInt16LE(C * 2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(d.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, d]));
}
