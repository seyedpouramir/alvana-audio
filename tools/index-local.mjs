#!/usr/bin/env node
// Alvana Audio · index YOUR OWN sound packs (bought or downloaded under a licence that does not allow sharing)
// so Claude can search and place them exactly like the library — without ever uploading them anywhere.
//
//   node index-local.mjs <yourPackFolder> [--to public/audio] [--level]
//
// Writes <to>/.alvana/local-index.json: one entry per file with a category guessed from folder and file names
// (whoosh, riser, impact, ui, pop, glitch, camera, money, …), duration, the time of the peak (place the file
// that much earlier than the visible event) and brightness. With --level, also writes levelled 48 kHz WAV
// copies to <to>/local/… (active RMS −20 dBFS, peak ≤ −1 dBFS — the same loudness as the library).
// Then: node get.mjs search whoosh   → your files show up marked LOCAL.
// Keep these files out of public repositories (add <to>/local/ to .gitignore).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2);
const SRC = argv[0];
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
if (!SRC || !fs.existsSync(SRC)) { console.log("usage: node index-local.mjs <yourPackFolder> [--to public/audio] [--level]"); process.exit(1); }
const TO = flag("to", "public/audio"), LEVEL = argv.includes("--level"), SR = 48000;
const AUD = /\.(wav|mp3|ogg|flac|m4a|aif|aiff|wma)$/i;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

const RULES = [
  ["camera", /camera|cammera|shutter|photo/i], ["whoosh", /whoosh|woosh|swoosh|swish|swipe|sweep|transition|pass ?by/i], ["riser", /riser|rise|build|uplift|downlift|tension/i],
  ["impact", /impact|hit|boom|thud|punch|slam|drop|bass|braam|stomp/i], ["glitch", /glitch|static|distort|bitcrush/i],
  ["money", /money|cash|coin|register|ching/i], ["data", /data|computer|process|scan|hud|beep seq/i],
  ["keyboard", /typ(e|ing)|keyboard|key ?press|backspace|enter/i], ["pop", /pop|bubble|plop/i], ["notification", /notif|ding|success|alert|chime|bell/i],
  ["mechanical", /gear|ratchet|clock|tick|machine|mechan|servo/i], ["ui", /ui|click|button|tap|toggle|switch|hover|select|open|close/i],
  ["magic", /magic|sparkle|shimmer|twinkle/i], ["explosion", /explo|blast|firework|gun|shot/i], ["ambience", /ambien|atmos|room ?tone|loop|rain|wind/i],
];
const guess = (rel) => (RULES.find(([, re]) => re.test(rel)) || ["misc"])[0];

function decode(f) {
  const raw = execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-i", f, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}
const out = { name: "local", built: new Date().toISOString().slice(0, 10), sfx: [] }, used = new Set();
for (const f of walk(SRC).filter((f) => AUD.test(f) && !path.basename(f).startsWith("._"))) {
  const rel = path.relative(SRC, f), cat = guess(rel);
  let name = kebab(path.basename(f).replace(/\.[^.]+$/, "")) || "sound", k = 2;
  while (used.has(`${cat}/${name}`)) name = `${name.replace(/-\d+$/, "")}-${k++}`;
  used.add(`${cat}/${name}`);
  let x;
  try { x = decode(f); } catch { console.error(`skip (cannot decode): ${rel}`); continue; }
  let pk = 0, pi = 0;
  for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > pk) { pk = Math.abs(x[i]); pi = i; }
  if (pk < 1e-4) continue;
  let on = 0;
  while (on < x.length && Math.abs(x[on]) < pk * 0.1) on++;
  const e = { id: `local-${cat}/${name}`, cat, tags: [cat, ...kebab(rel).split("-").filter((w) => w.length > 2 && !/^\d+$/.test(w))].slice(0, 8),
    dur: +(x.length / SR).toFixed(3), peak: +(pi / SR).toFixed(3), onset: +(on / SR).toFixed(3), path: f.split(path.sep).join("/"), lic: "private", local: true };
  if (LEVEL) {
    // active RMS over 10 ms windows within 30 dB of the loudest one → −20 dBFS, peak capped at −1 dBFS
    const W = 480, win = [];
    for (let i = 0; i + W <= x.length; i += W) { let s = 0; for (let j = i; j < i + W; j++) s += x[j] * x[j]; win.push(s / W); }
    const top = Math.max(...win, 1e-12), act = win.filter((v) => v > top * 0.001);
    const arms = Math.sqrt(act.reduce((a, v) => a + v, 0) / Math.max(1, act.length)) || pk;
    const g = Math.min(0.1 / arms, 0.891 / pk), dst = path.join(TO, "local", cat, `${name}.wav`);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    execFileSync("ffmpeg", ["-v", "error", "-nostdin", "-y", "-i", f, "-af", `volume=${g.toFixed(4)}`, "-ar", String(SR), "-c:a", "pcm_s16le", dst]);
    e.path = dst.split(path.sep).join("/");
  }
  out.sfx.push(e);
}
fs.mkdirSync(path.join(TO, ".alvana"), { recursive: true });
fs.writeFileSync(path.join(TO, ".alvana", "local-index.json"), JSON.stringify(out));
const counts = out.sfx.reduce((m, s) => ((m[s.cat] = (m[s.cat] || 0) + 1), m), {});
console.log(`${out.sfx.length} files → ${path.join(TO, ".alvana", "local-index.json")}\n` + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
