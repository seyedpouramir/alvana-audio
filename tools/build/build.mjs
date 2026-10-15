// Alvana Audio · build the library from the source packs listed in sources.mjs:
//   effects → trimmed, levelled (active RMS −20 dBFS, peak ≤ −1 dBFS; loops/beds RMS −26 dBFS), 48 kHz 16-bit WAV
//   music   → normalised to −16 LUFS (true peak ≤ −1 dBTP), MP3 VBR ~190 kbps, + a cue file (bpm, beats, bars,
//             kicks, snares, energy curve, drops / breaks)
// Usage:
//   node tools/build/build.mjs <srcRoot> <repoRoot> sfx|music [--shard k/N]   → <srcRoot>/../_build/<type>-<k>.json
//   node tools/build/build.mjs <srcRoot> <repoRoot> merge                       → index.json + index/*.json
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { SFX_PACKS, MUSIC_SETS, ENDE, kebab } from "./sources.mjs";
import { beatMap, BEAT_SR, FPS } from "./beats.mjs";
import { writeWav } from "./dsp.mjs";

const [SRC, REPO, MODE] = process.argv.slice(2);
if (!SRC || !REPO || !MODE) { console.log("usage: node tools/build/build.mjs <srcRoot> <repoRoot> sfx|music|merge [--shard k/N]"); process.exit(1); }
const SHARD = (() => { const i = process.argv.indexOf("--shard"); if (i < 0) return [0, 1]; const [k, n] = process.argv[i + 1].split("/").map(Number); return [k, n]; })();
const CACHE = path.join(SRC, "..", "_build");
fs.mkdirSync(CACHE, { recursive: true });
const SR = 48000;
const AUD = /\.(wav|ogg|mp3|flac)$/i;
const r3 = (v) => Math.round(v * 1000) / 1000;

function decode(file, ch = 2, sr = SR, extra = []) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-nostdin", ...extra, "-i", file, "-ac", String(ch), "-ar", String(sr), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  const a = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  if (ch === 1) return [a];
  const n = a.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = a[2 * i]; R[i] = a[2 * i + 1]; }
  return [L, R];
}
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : [];

// ---------------------------------------------------------------- spectral centroid (brightness)
const NF = 2048, CS = new Float64Array(NF / 2), SN = new Float64Array(NF / 2), BR = new Uint32Array(NF);
for (let k = 0; k < NF / 2; k++) { CS[k] = Math.cos((2 * Math.PI * k) / NF); SN[k] = -Math.sin((2 * Math.PI * k) / NF); }
for (let i = 0, b = Math.log2(NF); i < NF; i++) { let r = 0; for (let k = 0; k < b; k++) r |= ((i >> k) & 1) << (b - 1 - k); BR[i] = r; }
/** magnitude-weighted spectral centroid (Hz) of the loudest frames, 40 Hz – 16 kHz */
function centroid(x) {
  const hop = NF / 2, frames = [];
  for (let s = 0; s + NF <= Math.max(x.length, NF); s += hop) { let e = 0; for (let i = s; i < Math.min(x.length, s + NF); i++) e += x[i] * x[i]; frames.push([e, s]); }
  frames.sort((a, b) => b[0] - a[0]);
  const re = new Float64Array(NF), im = new Float64Array(NF);
  let num = 0, den = 0;
  for (const [, s] of frames.slice(0, 8)) {
    for (let i = 0; i < NF; i++) { const v = s + i < x.length ? x[s + i] : 0; re[BR[i]] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / NF)); im[BR[i]] = 0; }
    for (let size = 2; size <= NF; size <<= 1) {
      const half = size >> 1, step = NF / size;
      for (let i = 0; i < NF; i += size) for (let j = 0; j < half; j++) {
        const k = j * step, a = i + j, b = a + half;
        const tr = re[b] * CS[k] - im[b] * SN[k], ti = re[b] * SN[k] + im[b] * CS[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
    for (let k = 2; k < NF / 2; k++) { const f = (k * SR) / NF; if (f > 16000) break; const p = Math.hypot(re[k], im[k]); num += p * f; den += p; }
  }
  return den ? num / den : 0;
}

// ---------------------------------------------------------------- effects
function processSfx(file, outFile, bed) {
  let [L, R] = decode(file);
  const n0 = L.length;
  let diff = 0, pk = 0;
  for (let i = 0; i < n0; i++) { const d = Math.abs(L[i] - R[i]); if (d > diff) diff = d; const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > pk) pk = a; }
  if (pk < 1e-4) return null;
  let ch = diff <= pk * 0.002 ? [L] : [L, R];
  const amax = (i) => (ch.length === 1 ? Math.abs(ch[0][i]) : Math.max(Math.abs(ch[0][i]), Math.abs(ch[1][i])));
  if (!bed) {
    let s = 0;
    while (s < n0 && amax(s) < pk * 0.01) s++;
    let e = n0 - 1;
    while (e > s && amax(e) < pk * 0.001) e--;
    const s0 = Math.max(0, s - Math.round(0.004 * SR)), e0 = Math.min(n0, e + Math.round(0.03 * SR));
    ch = ch.map((c) => c.slice(s0, e0));
    const n = ch[0].length, fi = Math.min(n, Math.round(0.002 * SR)), fo = Math.min(n, Math.round(0.02 * SR));
    for (const c of ch) { if (s0 > 0) for (let i = 0; i < fi; i++) c[i] *= i / fi; for (let i = 0; i < fo; i++) c[n - 1 - i] *= i / fo; }
  }
  const n = ch[0].length, W = 480, win = [];
  for (let i = 0; i + W <= n || (i === 0 && n > 0); i += W) {
    let s = 0, k = 0;
    for (const c of ch) for (let j = i; j < Math.min(n, i + W); j++) { s += c[j] * c[j]; k++; }
    win.push(s / Math.max(1, k));
    if (i + W > n) break;
  }
  const top = Math.max(...win);
  const act = bed ? win : win.filter((v) => v > top * 0.001);
  const arms = Math.sqrt(act.reduce((a, v) => a + v, 0) / act.length);
  let p2 = 0, pi = 0;
  for (const c of ch) for (let i = 0; i < n; i++) if (Math.abs(c[i]) > p2) { p2 = Math.abs(c[i]); pi = i; }
  const target = bed ? 0.05 : 0.1;
  const g = Math.min(target / arms, 0.891 / p2);
  for (const c of ch) for (let i = 0; i < n; i++) c[i] *= g;
  let on = 0;
  while (on < n && amax(on) < p2 * g * 0.1) on++;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  writeWav(outFile, ch.length === 1 ? ch[0] : ch, SR);
  const mid = ch.length === 1 ? ch[0] : ch[0].map((v, i) => 0.5 * (v + ch[1][i]));
  const fc = centroid(mid);
  // fingerprint for duplicates: 4 kHz, 6-bit, first 3 s
  const step = 12, q = [];
  for (let i = 0; i < Math.min(n, 3 * SR); i += step) q.push(Math.round(mid[i] * 32));
  const fp = crypto.createHash("sha1").update(Int8Array.from(q)).digest("hex").slice(0, 16);
  return {
    dur: r3(n / SR), peak: r3(pi / SR), onset: r3(on / SR), ch: ch.length,
    lvl: Math.round(20 * Math.log10(arms * g) * 10) / 10, tone: fc < 1800 ? "warm" : fc < 3800 ? "balanced" : "bright", fp,
  };
}

function sfxItems() {
  const items = [];
  for (const P of SFX_PACKS) {
    const dir = path.join(SRC, P.dir);
    if (P.meta) {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, P.meta), "utf8"));
      for (const m of meta) {
        const cat = /^heartbeat/.test(m.id) ? "body" : m.cat;
        let name = m.id.replace(new RegExp(`^${cat}-`), "").replace(/^bed-/, "");
        if (/^\d+$/.test(name)) name = m.id;
        items.push({ src: path.join(dir, m.file), pack: P.key, cat, name, title: m.title, tags: [...new Set([cat, ...m.tags])], bed: cat === "ambience" });
      }
      continue;
    }
    for (const f of walk(dir).filter((f) => AUD.test(f)).sort()) {
      const stem = path.basename(f).replace(/\.[^.]+$/, "");
      const m = P.map(stem);
      if (!m) continue;
      items.push({ src: f, pack: P.key, cat: m.cat, name: m.name, title: null, tags: m.tags, bed: m.cat === "ambience" || /loop/.test(m.name) });
    }
  }
  // unique ids
  const seen = new Map();
  for (const it of items) {
    let id = `${it.cat}/${it.name}`;
    if (seen.has(id)) { let k = 2; while (seen.has(`${id}-${k}`)) k++; id = `${id}-${k}`; }
    seen.set(id, 1);
    it.id = id;
  }
  return items;
}

// ---------------------------------------------------------------- music
function loudness(file) {
  const r = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-i", file, "-af", "loudnorm=I=-16:TP=-1:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const s = r.stderr, j = JSON.parse(s.slice(s.lastIndexOf("{"), s.lastIndexOf("}") + 1));
  return { I: +j.input_i, TP: +j.input_tp, LRA: +j.input_lra };
}
function leadSilence(file) {
  const [x] = decode(file, 1, 22050, ["-t", "6"]);
  let i = 0;
  while (i < x.length && Math.abs(x[i]) < 0.001) i++;
  return i >= x.length ? 0 : Math.max(0, i / 22050 - 0.02);
}
function analyse(file) {
  const [x] = decode(file, 1, BEAT_SR);
  const dur = x.length / BEAT_SR;
  const bm = beatMap(x);
  // energy: frame RMS → 0.5 s blocks → 0..100 relative to the track's 95th percentile
  const per = Math.round(FPS / 2), blocks = [];
  for (let i = 0; i < bm.rms.length; i += per) { let s = 0, k = 0; for (let j = i; j < Math.min(bm.rms.length, i + per); j++) { s += bm.rms[j]; k++; } blocks.push(s / Math.max(1, k)); }
  const sorted = [...blocks].sort((a, b) => a - b), hi = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const energy = blocks.map((v) => Math.min(100, Math.round((v / hi) * 100)));
  const at = (t0, t1) => { const a = Math.floor(t0 * 2), b = Math.max(a + 1, Math.ceil(t1 * 2)); let s = 0, k = 0; for (let i = a; i < Math.min(b, energy.length); i++) { s += energy[i]; k++; } return k ? s / k / 100 : 0; };
  const med = (sorted[Math.floor(sorted.length / 2)] || 0) / hi;
  // 4-bar phrases (or 8 s blocks without a reliable grid)
  let marks = bm.bars.length > 8 ? bm.bars.filter((_, i) => i % 4 === 0) : [];
  if (!marks.length) for (let t = 0; t < dur; t += 8) marks.push(r3(t));
  if (marks[0] > 0.5) marks = [0, ...marks];
  const ph = marks.map((t, i) => ({ t: r3(t), e: at(t, marks[i + 1] ?? dur) }));
  const drops = [], breaks = [];
  for (let i = 1; i < ph.length; i++) {
    const d = ph[i].e - ph[i - 1].e;
    if (d >= 0.18) drops.push([ph[i].t, d]);
    if (d <= -0.18) breaks.push([ph[i].t, d]);
  }
  const firstLoud = ph.find((p) => p.e >= 0.6 * med);
  let outro = null;
  for (let i = ph.length - 1; i > 0 && ph[i].e < 0.6 * med; i--) outro = ph[i].t;
  const busy = (bm.kicks.length + bm.snares.length) / Math.max(1, dur);
  const score = Math.min(1, busy / 4) * 0.6 + Math.min(1, Math.max(0, (bm.bpm - 60) / 100)) * 0.4;
  return {
    dur: r3(dur), bpm: bm.bpm,
    cues: {
      bpm: bm.bpm, beats: bm.beats, bars: bm.bars, kicks: bm.kicks, snares: bm.snares,
      energy: { step: 0.5, v: energy },
      phrases: ph.map((p) => [p.t, Math.round(p.e * 100)]),
      drops: drops.sort((a, b) => b[1] - a[1]).slice(0, 4).map((d) => d[0]).sort((a, b) => a - b),
      breaks: breaks.sort((a, b) => a[1] - b[1]).slice(0, 4).map((d) => d[0]).sort((a, b) => a - b),
      intro_end: firstLoud && firstLoud.t > 0 ? firstLoud.t : 0,
      outro_start: outro,
    },
    start: at(0, 1.5) >= 0.45 * med ? "instant" : "builds",
    ending: at(Math.max(0, dur - 2.5), dur) < 0.3 * med ? "fade" : "hard",
    intensity: score < 0.38 ? "low" : score < 0.6 ? "mid" : "high",
  };
}
function processTrack(t) {
  const out = path.join(REPO, t.file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const L = loudness(t.src), lead = leadSilence(t.src);
  const g = Math.min(-16 - L.I, -1.2 - L.TP);
  execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-y", "-ss", lead.toFixed(3), "-i", t.src, "-map", "0:a", "-map_metadata", "-1",
    "-af", `volume=${g.toFixed(2)}dB`, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-q:a", "2", "-id3v2_version", "3",
    "-metadata", `title=${t.title}`, "-metadata", `artist=${t.artist}`, "-metadata", `album=${t.album}`,
    "-metadata", `comment=${t.lic} · alvana-audio`, out]);
  const a = analyse(out), L2 = loudness(out);
  fs.writeFileSync(out.replace(/\.mp3$/, ".json"), JSON.stringify({ id: t.id, title: t.title, artist: t.artist, dur: a.dur, ...a.cues }));
  return { dur: a.dur, bpm: a.bpm, start: a.start, ending: a.ending, intensity: a.intensity, lufs: Math.round(L2.I * 10) / 10, tp: Math.round(L2.TP * 10) / 10 };
}
function musicItems() {
  const items = [], used = new Set();
  const slug = (mood, title) => { let s = kebab(title), k = 2; while (used.has(`${mood}/${s}`)) s = `${kebab(title)}-${k++}`; used.add(`${mood}/${s}`); return s; };
  for (const S of MUSIC_SETS) {
    for (const f of walk(path.join(SRC, S.dir)).filter((f) => /\.mp3$/i.test(f)).sort()) {
      const title = path.basename(f).replace(/\.mp3(\.mp3)?$/i, "").replace(/^\d+[ ._-]*/, "").replace(/HoliznaCC0[ -]*/i, "").trim();
      const s = slug(S.mood, title);
      items.push({ src: f, id: `${S.mood}/${s}`, file: `music/${S.mood}/${s}.mp3`, title, artist: S.artist, album: S.album, mood: S.mood, tags: [...new Set([S.mood, ...S.tags])], lic: S.lic, pack: S.key });
    }
  }
  for (const [stem, T] of Object.entries(ENDE.tracks)) {
    const s = slug(ENDE.mood, `business-moves-${stem.match(/vol-(\d+)/)[1].padStart(2, "0")}`);
    items.push({ src: path.join(SRC, ENDE.dir, `${stem}.mp3`), id: `${ENDE.mood}/${s}`, file: `music/${ENDE.mood}/${s}.mp3`, title: T.title, artist: ENDE.artist, album: "Happy Beats Business Moves", mood: ENDE.mood, tags: [...new Set([ENDE.mood, ...T.tags])], lic: ENDE.lic, pack: "ende" });
  }
  return items;
}

// ---------------------------------------------------------------- run
const [K, N] = SHARD;
if (MODE === "sfx") {
  const items = sfxItems().filter((_, i) => i % N === K), res = [];
  let k = 0;
  for (const it of items) {
    const file = `sfx/${it.id}.wav`;
    const m = processSfx(it.src, path.join(REPO, file), it.bed);
    if (m) res.push({ id: it.id, file, cat: it.cat, title: it.title, tags: it.tags, pack: it.pack, bed: it.bed || undefined, ...m });
    if (++k % 50 === 0) console.log(`sfx shard ${K}: ${k}/${items.length}`);
  }
  fs.writeFileSync(path.join(CACHE, `sfx-${K}.json`), JSON.stringify(res));
  console.log(`sfx shard ${K}/${N}: ${res.length} effects`);
} else if (MODE === "music") {
  const items = musicItems().filter((_, i) => i % N === K), res = [];
  for (const it of items) {
    const m = processTrack(it);
    const { src, ...rest } = it;
    res.push({ ...rest, ...m });
    console.log(`music shard ${K}: ${res.length}/${items.length} ${it.id} · ${m.bpm} bpm · ${m.intensity}`);
  }
  fs.writeFileSync(path.join(CACHE, `music-${K}.json`), JSON.stringify(res));
} else if (MODE === "merge") {
  const read = (t) => fs.readdirSync(CACHE).filter((f) => f.startsWith(`${t}-`)).flatMap((f) => JSON.parse(fs.readFileSync(path.join(CACHE, f), "utf8")));
  let sfx = read("sfx").sort((a, b) => a.id.localeCompare(b.id));
  // duplicates (same audio in two packs): keep the first, delete the file
  const fps = new Map(), dups = [];
  sfx = sfx.filter((s) => { if (fps.has(s.fp)) { dups.push(`${s.id} = ${fps.get(s.fp)}`); fs.rmSync(path.join(REPO, s.file), { force: true }); return false; } fps.set(s.fp, s.id); return true; });
  const music = read("music").sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(path.join(CACHE, "merged.json"), JSON.stringify({ sfx, music, dups }));
  console.log(`merged: ${sfx.length} effects (${dups.length} duplicates removed) · ${music.length} tracks`);
}
