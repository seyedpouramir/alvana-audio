// Alvana Audio · preview reels so people can listen to a whole category in one file.
//   sfx:   every effect of the category in catalogue order (long ones cut at 3.5 s), 0.45 s apart → mono MP3
//   music: ~12 s of each track (from its first drop, or a bar near 30 %), short fades → stereo MP3
// Usage: node tools/build/previews.mjs <repoRoot>   (after docs.mjs)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { writeWav } from "./dsp.mjs";

const REPO = process.argv[2];
const I = JSON.parse(fs.readFileSync(path.join(REPO, "index.json"), "utf8"));
const SR = 48000;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "alvana-prev-"));
fs.mkdirSync(path.join(REPO, "previews"), { recursive: true });

function decode(file, ch, from = 0, len = 0) {
  const a = ["-v", "error", "-nostdin", ...(from ? ["-ss", String(from)] : []), ...(len ? ["-t", String(len)] : []), "-i", file, "-ac", String(ch), "-ar", String(SR), "-f", "f32le", "-"];
  const raw = execFileSync("ffmpeg", a, { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}
function encode(chunks, ch, out, kbps) {
  const n = chunks.reduce((a, c) => a + c.length, 0), all = new Float32Array(n);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const wav = path.join(TMP, "reel.wav");
  if (ch === 1) writeWav(wav, all, SR);
  else { const L = new Float32Array(n / 2), R = new Float32Array(n / 2); for (let i = 0; i < n / 2; i++) { L[i] = all[2 * i]; R[i] = all[2 * i + 1]; } writeWav(wav, [L, R], SR); }
  execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-y", "-i", wav, "-c:a", "libmp3lame", "-b:a", `${kbps}k`, ...(ch === 1 ? ["-ac", "1"] : []), out]);
}
const fadeOut = (x, ch, sec) => { const n = Math.round(sec * SR) * ch; for (let i = 0; i < Math.min(n, x.length); i++) x[x.length - 1 - i] *= i / n; return x; };
const fadeIn = (x, ch, sec) => { const n = Math.round(sec * SR) * ch; for (let i = 0; i < Math.min(n, x.length); i++) x[i] *= i / n; return x; };

// effects
const cats = [...new Set(I.sfx.map((s) => s.cat))];
for (const c of cats) {
  const chunks = [];
  for (const s of I.sfx.filter((x) => x.cat === c)) {
    let x = decode(path.join(REPO, s.file), 1, 0, 3.5);
    if (s.dur > 3.5) fadeOut(x, 1, 0.3);
    if (s.bed) x = fadeIn(x, 1, 0.3);
    chunks.push(x, new Float32Array(Math.round(0.45 * SR)));
  }
  encode(chunks, 1, path.join(REPO, "previews", `sfx-${c}.mp3`), 64);
  console.log(`previews/sfx-${c}.mp3`);
}
// music
const moods = [...new Set(I.music.map((m) => m.mood))];
for (const md of moods) {
  const chunks = [];
  for (const m of I.music.filter((x) => x.mood === md)) {
    const cues = JSON.parse(fs.readFileSync(path.join(REPO, m.cues), "utf8"));
    let st = 0;
    if (m.dur > 30) {
      const d = (cues.drops || []).find((t) => t > m.dur * 0.08 && t < m.dur * 0.6);
      st = d ?? (cues.bars || []).reduce((b, t) => (Math.abs(t - m.dur * 0.3) < Math.abs(b - m.dur * 0.3) ? t : b), m.dur * 0.3);
    }
    const x = decode(path.join(REPO, m.file), 2, Math.max(0, st), 12);
    fadeIn(x, 2, 0.4); fadeOut(x, 2, 1.2);
    chunks.push(x, new Float32Array(Math.round(0.35 * SR) * 2));
  }
  encode(chunks, 2, path.join(REPO, "previews", `music-${md}.mp3`), 96);
  console.log(`previews/music-${md}.mp3`);
}
fs.rmSync(TMP, { recursive: true, force: true });
