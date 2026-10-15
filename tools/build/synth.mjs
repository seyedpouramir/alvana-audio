// Alvana Audio · effects synthesized for this library (CC0). Same code + same seed → the same files.
// Usage: node tools/build/synth.mjs <outDir>   → <outDir>/<id>.wav + <outDir>/synth-meta.json
import fs from "node:fs";
import path from "node:path";
import {
  SR, TAU, reseed, rnd, rr, len, buf, sbuf, secs, white, pink, brown, osc, shape, decay, fades, mix, smix, gain, sat, unit,
  smooth, lerp, expl, rev, midi, lp, hp, bp, eq, modes, pan, reverb, loopify, normPeak, writeWav,
} from "./dsp.mjs";

const OUT = process.argv[2];
if (!OUT) { console.log("usage: node tools/build/synth.mjs <outDir>"); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });

// =============== families ===============

/** air moving past the listener: band-passed pink noise whose centre glides up to the pass and back down */
function whoosh(o = {}) {
  const { d = 0.6, f0 = 350, f1 = 2200, f2 = 500, q0 = 0.7, q1 = 1.8, at = 0.55, rise = 2.2, fall = 1.6, air = 0.22, body = 0.35,
    p0 = -0.7, p1 = 0.7, wet = 0.12, rt = 0.7, tone = 0, t0 = 220, t1 = 330, gate = 0 } = o;
  const n = len(d);
  const env = (p) => (p < at ? Math.pow(p / at, rise) : Math.pow(Math.max(0, 1 - (p - at) / (1 - at)), fall));
  const fc = (i) => { const p = i / n; return p < at ? expl(f0, f1, smooth(p / at)) : expl(f1, f2, smooth((p - at) / (1 - at))); };
  const qq = (i) => lerp(q0, q1, 1 - Math.min(1, Math.abs(i / n - at) / Math.max(at, 1 - at)));
  const core = shape(unit(bp(pink(d), fc, qq)), env);
  mix(core, shape(unit(hp(white(d), (i) => fc(i) * 2.2 + 1500, 0.7)), (p) => env(p) ** 1.5), 0, air);
  mix(core, shape(unit(lp(brown(d), (i) => 110 + fc(i) * 0.15, 0.7)), env), 0, body);
  if (tone) mix(core, shape(unit(lp(osc(d, (s) => expl(t0, t1, s / d), "saw"), 900, 0.8)), (p) => env(p) ** 1.2), 0, tone);
  if (gate) shape(core, (_, s) => (Math.floor(s * gate) % 2 === 0 ? 1 : 0.2));
  fades(core, 0.004, 0.02);
  return reverb(pan(core, (p) => lerp(p0, p1, smooth(p))), wet, rt);
}

/** build-up: rising high-passed noise + a detuned saw stack gliding up, optional accelerating tremolo and sub */
function riser(o = {}) {
  const { d = 3, nz = 0.8, tone = 0.6, f0 = 110, f1 = 440, v = 5, det = 0.012, h0 = 250, h1 = 7000, k = 2.4, trem = 0, sub = 0,
    wet = 0.2, rt = 1.4, cut = true } = o;
  const n = len(d), env = (p) => Math.pow(p, k), m = buf(d);
  if (nz) mix(m, shape(unit(hp(white(d), (i) => expl(h0, h1, i / n), 0.8)), env), 0, nz);
  if (tone) {
    const t = buf(d);
    for (let j = 0; j < v; j++) { const dt = 1 + det * (j - (v - 1) / 2); mix(t, osc(d, (s) => expl(f0, f1, Math.pow(s / d, 1.3)) * dt, "saw", rnd())); }
    mix(m, shape(unit(lp(t, (i) => expl(500, 9000, Math.pow(i / n, 1.5)), 1.2)), env), 0, tone);
  }
  if (sub) mix(m, shape(unit(osc(d, (s) => expl(38, 76, s / d))), env), 0, sub);
  if (trem) shape(m, (_, s) => 0.6 + 0.4 * Math.sin(TAU * trem * (s + (2 * s * s) / d)));
  fades(m, 0.01, cut ? 0.008 : 0.15);
  return reverb(pan(m, 0), wet, rt);
}

/** the opposite of a riser: a falling filter sweep and pitch drop after a hit */
function downer(o = {}) {
  const { d = 2, f0 = 7000, f1 = 150, tone = 0.4, t0 = 600, t1 = 55, wet = 0.25, rt = 1.5 } = o;
  const n = len(d), env = (p) => Math.min(1, p / 0.02) * Math.pow(1 - p, 1.6);
  const m = shape(unit(lp(white(d), (i) => expl(f0, f1, i / n), 1.1)), env);
  if (tone) mix(m, shape(unit(lp(osc(d, (s) => expl(t0, t1, s / d), "saw"), (i) => expl(3000, 200, i / n), 0.9)), env), 0, tone);
  fades(m, 0.002, 0.05);
  return reverb(pan(m, (p) => lerp(0.25, -0.25, p)), wet, rt);
}

/** a sub-bass drop (sine falling in pitch, a little saturation) */
function subdrop(o = {}) {
  const { d = 1.8, f0 = 95, f1 = 28, tau = 0.6, click = 0.15, drive = 1.8 } = o;
  const m = decay(osc(d, (s) => expl(f0, f1, s / (d * 0.7))), tau, 0.002);
  sat(m, drive);
  if (click) mix(m, decay(unit(hp(white(0.02), 1500)), 0.004, 0.0003), 0, click);
  return pan(fades(m, 0.001, 0.08), 0);
}

/** a cinematic hit: sub thump + noise body + crack (+ metal partials), saturated, in a big room */
function impact(o = {}) {
  const { d = 2.2, sub = 1, s0 = 75, s1 = 36, stau = 0.45, body = 0.6, blp = 1800, btau = 0.09, crack = 0.35, metal = 0, mf = 210,
    wet = 0.32, rt = 2.2, drive = 1.4 } = o;
  const m = buf(d);
  mix(m, decay(osc(d, (s) => expl(s0, s1, s / 0.5)), stau, 0.0015), 0, sub);
  const bn = unit(brown(0.7));
  mix(bn, unit(white(0.7)), 0, 0.5);
  mix(m, decay(unit(lp(bn, blp, 0.8)), btau, 0.001), 0, body * 0.35);
  mix(m, decay(unit(hp(white(0.08), 2500, 0.7)), 0.012, 0.0005), 0, crack * 0.3);
  if (metal) mix(m, modes(1.6, [[mf, 1, 0.4], [mf * 2.76, 0.6, 0.25], [mf * 5.4, 0.4, 0.15], [mf * 8.93, 0.25, 0.09]]), 0, metal);
  sat(m, drive);
  fades(m, 0.0005, 0.1);
  return reverb(pan(m, 0), wet, rt, { damp: 1.2 });
}

/** a short hit with a long tail, reversed: it swells up and stops exactly on the cut */
function swell(o = {}) {
  const { d = 1.6, kind = "cymbal", f = 440, wet = 0.9, rt = 2.6 } = o;
  let hit;
  if (kind === "cymbal") {
    hit = decay(unit(bp(white(2.5), 7000, 0.5)), 0.7, 0.001);
    mix(hit, modes(2.5, [[3150, 1, 0.9], [4720, 0.8, 0.7], [6230, 0.6, 0.6], [8410, 0.5, 0.5], [10900, 0.3, 0.4]]), 0, 0.15);
  } else {
    hit = modes(2.5, [[f, 1, 1.1], [f * 2.01, 0.5, 0.7], [f * 3.02, 0.3, 0.5], [f * 4.07, 0.15, 0.3]]);
    mix(hit, modes(2.5, [[f * 1.5, 0.6, 0.9], [f * 3.01, 0.2, 0.5]]), 0, 0.6);
  }
  const [L, R] = reverb(pan(hit, 0), wet, rt, { bright: 9000 });
  const n = Math.min(L.length, len(d));
  const out = [rev(L).slice(L.length - n), rev(R).slice(R.length - n)];
  out.forEach((c) => fades(c, 0.05, 0.003));
  return out;
}

/** digital glitch: random short slices of square blips, crushed noise and chirps, each panned on its own */
function glitch(o = {}) {
  const { d = 0.35, crush = 8, stutter = 0, lpf = 9000 } = o;
  const out = sbuf(d);
  const slice = () => {
    const L = rr(0.012, 0.05), k = rnd();
    let s;
    if (k < 0.35) s = osc(L, rr(180, 2600), "sq");
    else if (k < 0.7) {
      const w = white(L), h = Math.floor(rr(3, crush * 2));
      s = new Float32Array(w.length);
      for (let i = 0; i < w.length; i++) s[i] = w[i - (i % h)];
      s = bp(s, rr(800, 5000), 0.9);
      unit(s);
      gain(s, 0.6);
    } else { const a = rr(300, 3000), b = rr(300, 3000); s = osc(L, (t) => expl(a, b, t / L), "saw"); }
    return fades(s, 0.001, 0.002);
  };
  let t = 0;
  if (stutter) {
    const s = slice(), p = rr(-0.5, 0.5);
    for (let k = 0; k < stutter && t < d - 0.01; k++) { smix(out, pan(s, p), t, 1 - k * 0.06); t += secs(s) + 0.012; }
  } else {
    while (t < d - 0.015) {
      if (rnd() < 0.18) { t += rr(0.01, 0.03); continue; }
      const s = slice();
      smix(out, pan(s, rr(-0.7, 0.7)), t, rr(0.6, 1));
      t += secs(s) + rr(0, 0.01);
    }
  }
  return [lp(out[0], lpf), lp(out[1], lpf)];
}

/** computer "thinking": quick pentatonic beeps */
function beeps(o = {}) {
  const { d = 1.6, rate = 14, lo = 76, hi = 98, wave = "sine", tau = 0.02, wet = 0.08 } = o;
  const notes = [];
  for (let m = lo; m <= hi; m++) if ([0, 2, 4, 7, 9].includes(m % 12)) notes.push(m);
  const out = sbuf(d);
  for (let t = 0.005; t < d - 0.05; t += (1 / rate) * rr(0.6, 1.4)) {
    const b = decay(osc(0.08, midi(notes[Math.floor(rnd() * notes.length)]), wave), tau, 0.001);
    smix(out, pan(fades(b, 0.0005, 0.005), rr(-0.5, 0.5)), t, rr(0.5, 1));
  }
  return reverb(out, wet, 0.6);
}

/** a bell/marimba note */
const bell = (f, d = 1.2, tau = 0.4, bright = 1) =>
  modes(d, [[f, 1, tau], [f * 2.01, 0.35 * bright, tau * 0.6], [f * 3.02, 0.15 * bright, tau * 0.4], [f * 4.15, 0.07 * bright, tau * 0.3]]);
const marimba = (f, d = 0.6) => modes(d, [[f, 1, 0.22], [f * 3.93, 0.25, 0.05], [f * 9.2, 0.08, 0.015]], 0.001);
function notes(list, o = {}) {
  const { kind = "bell", wet = 0.18, rt = 1.0, spread = 0.25 } = o;
  const end = Math.max(...list.map(([t, , dd = 1]) => t + dd)) + 0.05;
  const out = sbuf(end);
  list.forEach(([t, m, dd = 1, g = 1], i) => {
    const f = midi(m);
    const s = kind === "marimba" ? marimba(f, dd) : kind === "tri" ? decay(lp(osc(dd, f, "tri"), 2500), 0.12, 0.002) : kind === "sq" ? decay(lp(osc(dd, f, "sq"), 3500), 0.07, 0.001) : bell(f, dd, 0.35);
    smix(out, pan(fades(s, 0.0005, 0.02), ((i % 2) * 2 - 1) * spread), t, g);
  });
  return reverb(out, wet, rt);
}

/** a UI click: a filtered noise tick + optional low thump and tonal ping */
function click(o = {}) {
  const { f = 3500, q = 4, tau = 0.004, thump = 0.4, tf = 180, ttau = 0.012, tone = 0, tfreq = 2000, d = 0.12 } = o;
  const m = buf(d);
  mix(m, decay(unit(bp(white(0.05), f, q)), tau, 0.0003), 0, 0.5);
  if (thump) mix(m, decay(osc(0.08, tf), ttau, 0.001), 0, thump);
  if (tone) mix(m, decay(osc(0.06, tfreq), 0.008, 0.0005), 0, tone);
  return pan(fades(m, 0.0003, 0.01), 0);
}
function seq(parts, d) {
  const out = sbuf(d);
  for (const [t, s, g = 1] of parts) smix(out, Array.isArray(s) ? s : pan(s, 0), t, g);
  return out;
}

/** a bubbly pop: a sine sweeping up very fast */
function pop(o = {}) {
  const { f0 = 300, f1 = 1100, t = 0.035, tau = 0.045, d = 0.16 } = o;
  const m = decay(osc(d, (s) => expl(f0, f1, s / t)), tau, 0.0008);
  mix(m, decay(unit(bp(white(0.01), 2500, 1)), 0.002, 0.0002), 0, 0.03);
  return pan(fades(m, 0.0005, 0.01), 0);
}

/** a mechanical camera shutter: curtain click, mirror slap, second curtain */
function shutter(o = {}) {
  const { gap = 0.085, bright = 1, mirror = 0.8, wind = 0 } = o;
  const d = 0.3 + (wind ? 0.55 : 0);
  const m = buf(d);
  const clk = (f, q, tau) => decay(unit(bp(white(0.03), f, q)), tau, 0.0002);
  mix(m, clk(2600 * bright, 2.5, 0.0045), 0.005, 0.5);
  mix(m, clk(5200 * bright, 4, 0.002), 0.005, 0.25);
  if (mirror) { mix(m, decay(osc(0.06, 140), 0.012, 0.001), 0.03, mirror * 0.8); mix(m, decay(unit(lp(white(0.04), 1200)), 0.01, 0.0005), 0.03, mirror * 0.25); }
  mix(m, clk(2000 * bright, 2.2, 0.005), 0.005 + gap, 0.45);
  mix(m, decay(osc(0.08, 3150), 0.03, 0.0005), 0.006, 0.05);
  if (wind) for (let k = 0; k < 9; k++) mix(m, ratchetClick(2600 + rr(-80, 80)), 0.28 + k * 0.045 + rr(0, 0.004), 0.35);
  return reverb(pan(fades(m, 0.0005, 0.02), 0), 0.06, 0.25);
}

/** one metal tooth click (modal) */
const ratchetClick = (f) => {
  const c = modes(0.06, [[f, 1, 0.008], [f * 1.73, 0.5, 0.006], [f * 2.61, 0.35, 0.004], [f * 0.52, 0.4, 0.012]]);
  mix(c, decay(unit(hp(white(0.01), 3000)), 0.0015, 0.0002), 0, 0.12);
  return c;
};
function ratchet(o = {}) {
  const { n = 10, dt = 0.028, accel = 1, f = 2400, hum = 0, wet = 0.08 } = o;
  let t = 0.005;
  const times = [];
  for (let k = 0; k < n; k++) { times.push(t); t += dt * Math.pow(accel, k); }
  const d = t + 0.15, m = buf(d);
  for (const tt of times) mix(m, ratchetClick(f * rr(0.97, 1.03)), tt, rr(0.7, 1));
  if (hum) mix(m, shape(unit(lp(osc(d, (s) => 50 + 25 * (s / d), "saw"), 300)), (p) => Math.sin(Math.PI * p)), 0, hum);
  return reverb(pan(fades(m, 0.001, 0.02), 0), wet, 0.35);
}

/** tick-tock clockwork (loops) */
function clock(o = {}) {
  const { d = 4, per = 0.5, f = [2900, 2300] } = o;
  const m = buf(d + 0.2);
  for (let k = 0; k * per < d; k++) mix(m, ratchetClick(f[k % 2]), k * per, k % 2 ? 0.8 : 1);
  return pan(m.slice(0, len(d)), 0);
}

function heartbeat(o = {}) {
  const { bpm = 64, beats = 2 } = o;
  const per = 60 / bpm, d = per * beats + 0.35, m = buf(d);
  const thump = (f0, f1) => decay(osc(0.3, (s) => expl(f0, f1, s / 0.09)), 0.065, 0.004);
  for (let k = 0; k < beats; k++) { mix(m, thump(72, 44), k * per, 1); mix(m, thump(62, 40), k * per + 0.28, 0.75); }
  return pan(fades(lp(m, 220, 0.7), 0.001, 0.05), 0);
}

/** sparkles: random (or rising) little bells in a hall */
function sparkle(o = {}) {
  const { d = 1.2, n = 18, lo = 2500, hi = 7000, rise = false, wet = 0.4, rt = 1.6, swish = 0 } = o;
  const out = sbuf(d);
  for (let k = 0; k < n; k++) {
    const t = rise ? (k / n) * d * 0.75 : rr(0, d * 0.6);
    const f = rise ? expl(lo, hi, k / n) * rr(0.98, 1.02) : rr(lo, hi);
    smix(out, pan(modes(0.5, [[f, 1, 0.12], [f * 2.4, 0.3, 0.06]]), rr(-0.8, 0.8)), t, rr(0.3, 1));
  }
  if (swish) smix(out, pan(shape(unit(hp(white(d), (i) => expl(1500, 9000, i / len(d)))), (p) => Math.pow(Math.sin(Math.PI * Math.min(1, p * 1.2)), 2)), 0), 0, swish);
  return reverb(out, wet, rt);
}

/** a soft high pad that swells and fades (for magic / reveal moments) */
function shimmer(o = {}) {
  const { d = 2.5, root = 84, wet = 0.5, rt = 2.2 } = o;
  const m = buf(d);
  for (const iv of [0, 7, 12, 16, 19]) for (const dt of [-0.004, 0.004]) mix(m, osc(d, midi(root + iv) * (1 + dt), "sine", rnd()), 0, 0.2);
  shape(m, (p, s) => Math.sin(Math.PI * p) ** 1.5 * (0.75 + 0.25 * Math.sin(TAU * 5.5 * s)));
  return reverb(pan(m, 0), wet, rt, { bright: 10000 });
}

/** coins: a few inharmonic coin modes */
const coin = (f) => modes(0.6, [[f, 1, 0.25], [f * 2.24, 0.6, 0.18], [f * 3.98, 0.4, 0.12], [f * 5.6, 0.2, 0.07]]);
function coins(o = {}) {
  const { kind = "drop" } = o;
  if (kind === "drop") {
    const out = buf(1.1);
    [[0, 1], [0.19, 0.7], [0.32, 0.5], [0.41, 0.35], [0.47, 0.25], [0.51, 0.15]].forEach(([t, g]) => mix(out, coin(3150 * rr(0.995, 1.005)), t, g));
    return reverb(pan(fades(out, 0.0005, 0.05), 0), 0.12, 0.5);
  }
  const out = sbuf(1.2);
  for (let k = 0; k < 28; k++) smix(out, pan(coin(rr(2400, 4200)), rr(-0.6, 0.6)), rr(0, 0.6) ** 1.3, rr(0.2, 0.7));
  return reverb(out, 0.1, 0.5);
}
function register() {
  const out = buf(1.6);
  mix(out, shape(unit(bp(white(0.25), (i) => expl(700, 1200, i / len(0.25)), 1.5)), (p) => Math.sin(Math.PI * p)), 0, 0.12);
  mix(out, decay(osc(0.1, 110), 0.03, 0.001), 0.2, 0.7);
  mix(out, decay(unit(lp(white(0.05), 1500)), 0.012, 0.0005), 0.2, 0.15);
  mix(out, modes(1.3, [[2930, 1, 0.55], [2955, 0.8, 0.5], [6120, 0.35, 0.25], [8800, 0.15, 0.12]]), 0.24, 0.9);
  return reverb(pan(fades(out, 0.001, 0.05), 0), 0.1, 0.6);
}

/** paper: a slide and a page flip */
function paperSlide(d = 0.45) {
  const n = len(d);
  const m = shape(unit(bp(pink(d), (i) => expl(1400, 2800, i / n), 0.9)), (p) => Math.sin(Math.PI * p) ** 1.5);
  mix(m, shape(unit(hp(white(d), 5000)), (p) => Math.sin(Math.PI * p) ** 3), 0, 0.15);
  return pan(fades(m, 0.005, 0.02), (p) => lerp(-0.3, 0.3, p));
}
function pageFlip() {
  const d = 0.35, m = shape(unit(lp(white(d), 6500)), (p, s) => Math.exp(-s / 0.09) * (0.55 + 0.45 * Math.sin(TAU * 28 * s)));
  mix(m, decay(unit(lp(white(0.05), 900)), 0.02, 0.001), 0.02, 0.4);
  return pan(fades(m, 0.002, 0.03), 0.1);
}

/** a machine powering down (or up when reversed) */
function power(up = false, d = 1.1) {
  const n = len(d);
  const m = osc(d, (s) => expl(up ? 40 : 420, up ? 420 : 32, s / d), "saw");
  const f = lp(m, (i) => expl(up ? 200 : 4000, up ? 4000 : 150, i / n), 2);
  shape(f, (p) => (up ? Math.min(1, p * 4) : Math.min(1, (1 - p) * 3)));
  return reverb(pan(fades(unit(f), 0.003, 0.03), 0), 0.12, 0.6);
}

/** ambience beds that loop without a seam (decorrelated left/right) */
function bed(kind, d = 12) {
  const xf = 1.5, D = d + xf;
  const one = () => {
    let m;
    if (kind === "wind") {
      const n = len(D), sp = rr(0.05, 0.09), ph = rr(0, TAU);
      m = bp(pink(D), (i) => 380 + 260 * Math.sin(TAU * sp * (i / SR) + ph) + 120 * Math.sin(TAU * 0.23 * (i / SR)), (i) => 1.2 + 0.6 * Math.sin(TAU * 0.11 * (i / SR)));
      shape(m, (_, s) => 0.55 + 0.45 * Math.sin(TAU * 0.07 * s + ph) ** 2);
      void n;
    } else if (kind === "room") {
      m = lp(brown(D), 320, 0.7);
      mix(m, unit(lp(pink(D), 1200)), 0, 0.03);
    } else {
      // night crickets: chirp trains at ~4.6 kHz over a soft breeze
      m = gain(unit(lp(brown(D), 400)), 0.15);
      for (let c = 0; c < 3; c++) {
        const f = rr(4300, 5000), rate = rr(0.9, 1.4), off = rr(0, 1);
        for (let t = off; t < D; t += 1 / rate) {
          const pulses = Math.floor(rr(3, 5));
          for (let k = 0; k < pulses; k++) mix(m, decay(osc(0.03, f), 0.006, 0.001), t + k * 0.022, rr(0.25, 0.45));
        }
      }
    }
    return loopify(unit(m), xf);
  };
  return [one(), one()];
}

// =============== the catalogue ===============
const R = [];
const add = (id, cat, title, tags, fn) => R.push({ id, cat, title, tags, fn });

// whooshes (transitions)
add("whoosh-soft-short", "whoosh", "Soft whoosh, short", ["transition", "air", "soft"], () => whoosh({ d: 0.35, f0: 420, f1: 1900, f2: 650, at: 0.5 }));
add("whoosh-soft-medium", "whoosh", "Soft whoosh, medium", ["transition", "air", "soft"], () => whoosh({ d: 0.6 }));
add("whoosh-soft-long", "whoosh", "Soft whoosh, long", ["transition", "air", "slow"], () => whoosh({ d: 1.1, at: 0.6, wet: 0.16, rt: 1.0 }));
add("whoosh-fast-bright", "whoosh", "Fast bright whoosh", ["transition", "fast", "bright", "swipe"], () => whoosh({ d: 0.25, f0: 900, f1: 4500, f2: 1500, air: 0.4, body: 0.15, at: 0.45 }));
add("whoosh-deep", "whoosh", "Deep whoosh", ["transition", "low", "heavy"], () => whoosh({ d: 0.7, f0: 150, f1: 700, f2: 200, body: 0.8, air: 0.08 }));
add("whoosh-cinematic", "whoosh", "Cinematic long whoosh with tone", ["transition", "cinematic", "trailer"], () => whoosh({ d: 1.6, f0: 200, f1: 1600, f2: 300, at: 0.62, wet: 0.25, rt: 1.6, tone: 0.25, t0: 110, t1: 165 }));
add("whoosh-swish-thin", "whoosh", "Thin swish (cane / sword-like)", ["swish", "fast", "thin"], () => whoosh({ d: 0.3, f0: 1500, f1: 5000, f2: 2500, q0: 2, q1: 5, air: 0.3, body: 0, at: 0.4 }));
add("whoosh-pass-by", "whoosh", "Pass-by whoosh, left to right", ["transition", "pan", "pass"], () => whoosh({ d: 1.2, at: 0.5, p0: -1, p1: 1, f0: 260, f1: 1500, f2: 260, wet: 0.14 }));
add("whoosh-reverse", "whoosh", "Reverse whoosh (slow rise, sharp stop)", ["transition", "reverse", "build"], () => whoosh({ d: 0.8, at: 0.88, rise: 1.6, fall: 0.6, f0: 300, f1: 2600, f2: 1800 }));
add("whoosh-double", "whoosh", "Double whoosh", ["transition", "fast", "double"], () => { const a = whoosh({ d: 0.3, f0: 600, f1: 2600, f2: 900 }); const b = whoosh({ d: 0.34, f0: 450, f1: 2000, f2: 600, p0: 0.7, p1: -0.7 }); const o = sbuf(secs(b) + 0.2); smix(o, a, 0); smix(o, b, 0.17, 0.8); return o; });
add("whoosh-scifi", "whoosh", "Sci-fi whoosh with a tonal glide", ["transition", "tech", "sci-fi"], () => whoosh({ d: 0.9, f0: 300, f1: 2400, f2: 500, tone: 0.45, t0: 180, t1: 720, wet: 0.2, rt: 1.1 }));
add("whoosh-stutter", "whoosh", "Glitchy stutter whoosh", ["transition", "glitch", "digital"], () => whoosh({ d: 0.6, gate: 28, f0: 500, f1: 3000, f2: 800 }));

// risers / downlifters / drops
add("riser-noise-2s", "riser", "Noise riser, 2 s", ["build", "tension", "transition"], () => riser({ d: 2, tone: 0, nz: 1 }));
add("riser-noise-4s", "riser", "Noise riser, 4 s", ["build", "tension", "transition"], () => riser({ d: 4, tone: 0, nz: 1, k: 2.8 }));
add("riser-tonal-3s", "riser", "Tonal riser, 3 s", ["build", "tension", "synth"], () => riser({ d: 3, nz: 0.5, tone: 0.8 }));
add("riser-tension-4s", "riser", "Tension riser with accelerating tremolo, 4 s", ["build", "suspense", "trailer"], () => riser({ d: 4, nz: 0.6, tone: 0.7, trem: 2.2, sub: 0.3 }));
add("riser-epic-6s", "riser", "Epic riser into a cut, 6 s", ["build", "trailer", "epic"], () => riser({ d: 6, nz: 0.7, tone: 0.7, f0: 55, f1: 440, sub: 0.45, k: 3, wet: 0.3, rt: 2 }));
add("riser-quick-1s", "riser", "Quick riser, 1 s", ["build", "reveal", "fast"], () => riser({ d: 1, nz: 0.9, tone: 0.4, h0: 600, k: 1.8 }));
add("downlifter-short", "riser", "Downlifter, 1.5 s", ["fall", "release", "after-hit"], () => downer({ d: 1.5 }));
add("downlifter-long", "riser", "Downlifter, 3 s", ["fall", "release", "after-hit"], () => downer({ d: 3, wet: 0.3 }));
add("downlifter-dark", "riser", "Dark downlifter", ["fall", "dark"], () => downer({ d: 2.2, f0: 3500, f1: 90, t0: 300, t1: 40, tone: 0.6 }));
add("subdrop-short", "impact", "Sub drop, short", ["bass", "drop", "hit"], () => subdrop({ d: 1.2, tau: 0.35 }));
add("subdrop-long", "impact", "Sub drop, long", ["bass", "drop", "trailer"], () => subdrop({ d: 2.6, tau: 0.9, f0: 110, f1: 26 }));
add("subdrop-punch", "impact", "Punchy sub drop", ["bass", "drop", "punch"], () => subdrop({ d: 1.0, tau: 0.25, f0: 140, f1: 40, click: 0.4, drive: 2.6 }));

// impacts / transitions with a hit
add("impact-cinematic-heavy", "impact", "Heavy cinematic hit", ["hit", "trailer", "boom", "reveal"], () => impact({}));
add("impact-soft-thump", "impact", "Soft thump", ["hit", "soft", "low"], () => impact({ d: 1.0, crack: 0.05, body: 0.4, wet: 0.12, rt: 0.8, stau: 0.18, drive: 1.1 }));
add("impact-metallic", "impact", "Metallic hit", ["hit", "metal", "clang"], () => impact({ metal: 0.6, crack: 0.5, wet: 0.28 }));
add("impact-distant-boom", "impact", "Distant boom", ["boom", "far", "thunder"], () => impact({ d: 3, crack: 0.02, blp: 600, btau: 0.25, wet: 0.5, rt: 3, stau: 0.7 }));
add("impact-punchy-short", "impact", "Punchy short hit", ["hit", "punch", "fast"], () => impact({ d: 0.8, wet: 0.08, rt: 0.5, stau: 0.12, crack: 0.6, drive: 2 }));
add("impact-glass-shimmer", "impact", "Hit with a glassy shimmer", ["hit", "bright", "reveal"], () => { const h = impact({ d: 2, wet: 0.25 }); smix(h, sparkle({ d: 1.4, n: 14, wet: 0.5 }), 0.01, 0.5); return h; });
add("whoosh-hit-1", "transition", "Whoosh into a hit", ["transition", "hit", "reveal"], () => { const w = whoosh({ d: 0.55, at: 0.92, rise: 1.8, fall: 0.5 }), h = impact({ d: 1.8 }); const o = sbuf(0.5 + secs(h)); smix(o, w, 0, 0.9); smix(o, h, 0.5, 1); return o; });
add("whoosh-hit-2", "transition", "Fast whoosh into a punch", ["transition", "hit", "fast"], () => { const w = whoosh({ d: 0.3, at: 0.9, f0: 800, f1: 4000, f2: 3000 }), h = impact({ d: 0.9, wet: 0.1, rt: 0.6, stau: 0.15, crack: 0.6 }); const o = sbuf(0.28 + secs(h)); smix(o, w, 0, 0.9); smix(o, h, 0.28, 1); return o; });
add("riser-hit", "transition", "Riser into a big hit", ["build", "hit", "trailer"], () => { const r = riser({ d: 2.5, wet: 0.1 }), h = impact({ d: 2.4, wet: 0.35 }); const o = sbuf(2.5 + secs(h)); smix(o, r, 0, 0.8); smix(o, h, 2.5, 1); return o; });
add("swell-cymbal-short", "transition", "Reverse cymbal swell, 1 s", ["reverse", "swell", "transition"], () => swell({ d: 1.0 }));
add("swell-cymbal-long", "transition", "Reverse cymbal swell, 2.5 s", ["reverse", "swell", "build"], () => swell({ d: 2.5, rt: 3.2 }));
add("swell-bell", "transition", "Reverse bell swell", ["reverse", "swell", "magic", "soft"], () => swell({ d: 1.6, kind: "bell", f: 523 }));
add("power-down", "transition", "Power down (tape-stop like)", ["stop", "fail", "machine"], () => power(false));
add("power-up", "transition", "Power up", ["start", "machine", "boot"], () => power(true));

// glitch & data
add("glitch-short-1", "glitch", "Short glitch 1", ["digital", "error", "tech"], () => glitch({ d: 0.25 }));
add("glitch-short-2", "glitch", "Short glitch 2", ["digital", "error", "tech"], () => glitch({ d: 0.3, crush: 12 }));
add("glitch-short-3", "glitch", "Short glitch 3", ["digital", "tech"], () => glitch({ d: 0.4, lpf: 6000 }));
add("glitch-stutter", "glitch", "Stutter glitch", ["digital", "repeat", "tech"], () => glitch({ d: 0.45, stutter: 7 }));
add("glitch-long", "glitch", "Long glitch burst", ["digital", "error", "chaos"], () => glitch({ d: 0.9 }));
add("glitch-static", "glitch", "TV static burst", ["static", "tv", "noise"], () => { const d = 0.6, m = shape(unit(bp(white(d), 3000, 0.4)), (p, s) => (0.6 + 0.4 * Math.sin(TAU * 50 * s)) * Math.sin(Math.PI * p) ** 0.4); mix(m, unit(osc(d, 100, "sq")), 0, 0.08); return pan(fades(m, 0.003, 0.03), 0); });
add("data-beeps", "data", "Computer thinking beeps", ["computer", "processing", "ai"], () => beeps({}));
add("data-beeps-fast", "data", "Fast data beeps", ["computer", "processing", "hacker"], () => beeps({ d: 1.2, rate: 26, wave: "sq", tau: 0.01, lo: 84, hi: 103 }));
add("data-collect", "data", "Data collected (rising blips + ding)", ["success", "collect", "ui"], () => notes([[0, 79, 0.15], [0.05, 83, 0.15], [0.1, 86, 0.15], [0.15, 91, 0.15], [0.2, 95, 0.15], [0.3, 98, 1.0]], { kind: "sq", wet: 0.15, rt: 0.7 }));
add("data-scan", "data", "Scanner sweep", ["scan", "hud", "tech"], () => { const d = 1.4, n = len(d); const m = shape(unit(bp(white(d), (i) => expl(500, 4500, i / n), 3)), (p, s) => Math.sin(Math.PI * p) ** 0.7 * (0.55 + 0.45 * Math.sin(TAU * 13 * s))); mix(m, shape(unit(osc(d, (s) => expl(600, 1200, s / d))), (p) => Math.sin(Math.PI * p)), 0, 0.15); return reverb(pan(fades(m, 0.005, 0.03), (p) => lerp(-0.6, 0.6, p)), 0.1, 0.6); });
add("hud-ping", "data", "Radar / HUD ping", ["radar", "ping", "hud"], () => { const m = buf(1.4); [[0, 1], [0.22, 0.4], [0.44, 0.15]].forEach(([t, g]) => mix(m, decay(osc(0.6, 1480), 0.12, 0.001), t, g)); return reverb(pan(m, 0), 0.25, 1.2); });
add("data-transfer", "data", "Data transfer chirps", ["modem", "transfer", "tech"], () => { const d = 1.5, out = sbuf(d); for (let t = 0; t < d - 0.08; t += rr(0.03, 0.08)) { const a = rr(900, 2600), b = a * rr(0.7, 1.4), L = rr(0.02, 0.06); smix(out, pan(fades(osc(L, (s) => expl(a, b, s / L)), 0.002, 0.005), rr(-0.4, 0.4)), t, rr(0.3, 0.7)); } return [lp(out[0], 5000), lp(out[1], 5000)]; });
add("typing-terminal", "data", "Terminal typing burst", ["typing", "keyboard", "hacker"], () => { const d = 1.6, m = buf(d); for (let t = 0.01; t < d - 0.05; t += rr(0.05, 0.13)) { mix(m, decay(unit(bp(white(0.02), rr(2500, 4000), 3)), 0.003, 0.0003), t, rr(0.15, 0.25)); mix(m, decay(osc(0.04, rr(170, 210)), 0.01, 0.001), t, 0.2); } return pan(fades(m, 0.001, 0.02), 0); });

// UI
add("ui-click-crisp", "ui", "Crisp click", ["click", "button", "tap"], () => click({ f: 4200, q: 5, tau: 0.0035, thump: 0.25 }));
add("ui-click-soft", "ui", "Soft click", ["click", "soft", "tap"], () => click({ f: 1500, q: 1.2, tau: 0.006, thump: 0.6, tf: 160 }));
add("ui-tap-wood", "ui", "Wooden tap", ["tap", "wood", "soft"], () => click({ f: 900, q: 8, tau: 0.012, thump: 0.3, tf: 230 }));
add("ui-click-tonal", "ui", "Tonal click", ["click", "select"], () => click({ f: 3000, q: 4, tau: 0.003, thump: 0.15, tone: 0.5, tfreq: 1800 }));
add("ui-toggle-on", "ui", "Toggle on", ["toggle", "switch", "on"], () => seq([[0, click({ f: 2200, tone: 0.3, tfreq: 1300 })], [0.06, click({ f: 3400, tone: 0.35, tfreq: 2100 })]], 0.25));
add("ui-toggle-off", "ui", "Toggle off", ["toggle", "switch", "off"], () => seq([[0, click({ f: 3400, tone: 0.35, tfreq: 2100 })], [0.06, click({ f: 2200, tone: 0.3, tfreq: 1300 })]], 0.25));
add("ui-hover", "ui", "Hover blip", ["hover", "blip", "soft"], () => pan(fades(decay(osc(0.08, 2100), 0.02, 0.003), 0.003, 0.01), 0));
add("ui-button-press", "ui", "Button press with a thunk", ["button", "press", "confirm"], () => click({ f: 2600, q: 3, tau: 0.005, thump: 0.9, tf: 120, ttau: 0.025 }));
add("ui-key-mech", "ui", "Mechanical key press", ["keyboard", "key", "typing"], () => { const m = buf(0.15); mix(m, decay(unit(bp(white(0.03), 3800, 4)), 0.004, 0.0002), 0, 0.6); mix(m, decay(osc(0.08, 260), 0.01, 0.001), 0.012, 0.35); mix(m, decay(unit(bp(white(0.02), 2400, 5)), 0.003), 0.045, 0.3); return pan(fades(m, 0.0003, 0.01), 0); });
add("ui-swipe", "ui", "Swipe", ["swipe", "slide", "transition"], () => whoosh({ d: 0.2, f0: 1200, f1: 4000, f2: 2500, body: 0, air: 0.4, wet: 0.05 }));

// pops, bubbles, notifications
add("pop-1", "pop", "Pop (high)", ["pop", "appear", "bubble"], () => pop({ f0: 380, f1: 1500 }));
add("pop-2", "pop", "Pop (mid)", ["pop", "appear"], () => pop({}));
add("pop-3", "pop", "Pop (low, soft)", ["pop", "soft", "appear"], () => pop({ f0: 180, f1: 600, tau: 0.06 }));
add("pop-4", "pop", "Pop (snappy)", ["pop", "snap", "appear"], () => pop({ f0: 600, f1: 2200, t: 0.02, tau: 0.025 }));
add("bubble-1", "pop", "Bubble", ["bubble", "water", "cute"], () => pop({ f0: 400, f1: 1400, t: 0.06, tau: 0.05, d: 0.18 }));
add("bubbles-cluster", "pop", "Bubble cluster", ["bubble", "water", "many"], () => { const out = sbuf(0.8); for (let k = 0; k < 7; k++) { const f0 = rr(300, 600); smix(out, pan(decay(osc(0.15, (s) => expl(f0, f0 * rr(2.5, 4), s / 0.05)), rr(0.03, 0.06), 0.001), rr(-0.6, 0.6)), rr(0, 0.6), rr(0.4, 1)); } return out; });
add("notify-ding", "notification", "Notification ding (two notes)", ["notification", "message", "bell"], () => notes([[0, 88, 1], [0.11, 93, 1.2]]));
add("notify-soft", "notification", "Soft marimba notification", ["notification", "soft", "marimba"], () => notes([[0, 79, 0.6], [0.12, 84, 0.7]], { kind: "marimba", wet: 0.12 }));
add("notify-message", "notification", "New message", ["message", "chat", "blip"], () => notes([[0, 86, 0.25], [0.09, 91, 0.35]], { kind: "tri", wet: 0.1, rt: 0.5 }));
add("success-arpeggio", "notification", "Success (rising arpeggio)", ["success", "complete", "win"], () => notes([[0, 84, 0.9], [0.07, 88, 0.9], [0.14, 91, 0.9], [0.21, 96, 1.4]]));
add("success-soft", "notification", "Soft success", ["success", "soft", "done"], () => notes([[0, 72, 0.8], [0.1, 79, 1.1]], { kind: "marimba", wet: 0.15 }));
add("error-buzz", "notification", "Error (two low notes)", ["error", "fail", "wrong"], () => notes([[0, 64, 0.25, 1], [0.13, 59, 0.45, 1]], { kind: "tri", wet: 0.06, rt: 0.4, spread: 0 }));
add("level-up", "notification", "Level up", ["success", "game", "upgrade"], () => notes([0, 4, 7, 12, 16, 19, 24, 28].map((iv, k) => [k * 0.05, 72 + iv, 0.3, 0.8 + k * 0.03]), { kind: "sq", wet: 0.14, rt: 0.6 }));
add("like-tap", "notification", "Like / heart tap", ["like", "heart", "social"], () => { const o = seq([[0, pop({ f0: 500, f1: 1800, t: 0.025, tau: 0.03 })]], 0.9); smix(o, sparkle({ d: 0.7, n: 7, lo: 3500, hi: 6500, wet: 0.25, rt: 0.8 }), 0.03, 0.5); return o; });
add("countdown-beeps", "notification", "Countdown 3-2-1 beeps", ["countdown", "timer", "start"], () => { const m = buf(3.9); [0, 1, 2].forEach((t) => mix(m, fades(osc(0.13, 1000), 0.002, 0.01), t, 0.5)); mix(m, fades(osc(0.65, 2000), 0.002, 0.08), 3, 0.5); return pan(m, 0); });
add("timer-done", "notification", "Timer done ring", ["timer", "alarm", "done"], () => notes([0, 0.18, 0.36, 0.7, 0.88, 1.06].map((t) => [t, 93, 0.5, 0.8]), { kind: "bell", wet: 0.1, spread: 0 }));

// camera / mechanical / clock / body
add("camera-shutter-dslr", "camera", "Camera shutter (DSLR)", ["camera", "photo", "shutter"], () => shutter({}));
add("camera-shutter-fast", "camera", "Camera shutter (fast, bright)", ["camera", "photo", "snap"], () => shutter({ gap: 0.035, bright: 1.25, mirror: 0.3 }));
add("camera-shutter-film", "camera", "Film camera shutter + wind", ["camera", "film", "retro"], () => shutter({ gap: 0.07, mirror: 0.6, wind: 1 }));
add("gear-ratchet", "mechanical", "Ratchet", ["gear", "click", "mechanical"], () => ratchet({}));
add("gear-winding", "mechanical", "Winding gear (speeding up)", ["gear", "machine", "build"], () => ratchet({ n: 26, dt: 0.06, accel: 0.93, hum: 0.25, f: 2100 }));
add("gear-clockwork", "mechanical", "Slow clockwork gear", ["gear", "clock", "mechanical"], () => ratchet({ n: 8, dt: 0.16, f: 1800 }));
add("clock-tick-tock", "mechanical", "Clock tick-tock (4 s loop)", ["clock", "time", "loop"], () => clock({}));
add("heartbeat", "mechanical", "Heartbeat (two beats)", ["heart", "tension", "body"], () => heartbeat({}));
add("heartbeat-fast", "mechanical", "Fast heartbeat", ["heart", "panic", "tension"], () => heartbeat({ bpm: 120, beats: 4 }));

// magic / money / paper
add("sparkle", "magic", "Sparkle", ["magic", "shine", "reveal"], () => sparkle({}));
add("sparkle-rise", "magic", "Rising sparkle", ["magic", "rise", "reveal"], () => sparkle({ rise: true, n: 22, swish: 0.25 }));
add("shimmer-pad", "magic", "Shimmer pad swell", ["magic", "pad", "dream"], () => shimmer({}));
add("coin-drop", "money", "Coin drop", ["coin", "money", "drop"], () => coins({ kind: "drop" }));
add("coins-handful", "money", "Handful of coins", ["coins", "money", "pile"], () => coins({ kind: "pile" }));
add("cash-register", "money", "Cash register ka-ching", ["money", "sale", "cash"], () => register());
add("paper-slide", "paper", "Paper slide", ["paper", "slide", "card"], () => paperSlide());
add("page-flip", "paper", "Page flip", ["paper", "page", "book"], () => pageFlip());

// beds
add("bed-wind", "ambience", "Wind (12 s seamless loop)", ["wind", "outdoor", "loop"], () => bed("wind"));
add("bed-room-tone", "ambience", "Room tone (12 s seamless loop)", ["room", "indoor", "loop", "quiet"], () => bed("room"));
add("bed-night-crickets", "ambience", "Night crickets (12 s seamless loop)", ["night", "crickets", "loop", "nature"], () => bed("crickets"));

// =============== render ===============
const meta = [];
R.forEach((r, k) => {
  reseed(1000 + k * 7919);
  const x = normPeak(r.fn(), 0.89);
  const f = path.join(OUT, `${r.id}.wav`);
  writeWav(f, x);
  meta.push({ id: r.id, cat: r.cat, title: r.title, tags: r.tags, file: `${r.id}.wav`, dur: +secs(x).toFixed(3) });
});
fs.writeFileSync(path.join(OUT, "synth-meta.json"), JSON.stringify(meta, null, 1));
console.log(`synth: ${meta.length} effects → ${OUT}`);
