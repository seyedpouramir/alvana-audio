#!/usr/bin/env node
// Alvana Audio · mix a voice-over, music and effects into one track (ffmpeg 6+), normalised to −14 LUFS for
// YouTube / Instagram, and optionally put it on your silent video.
//
//   node mix.mjs mix.json [--out out/mix.wav] [--video silent.mp4 --final final.mp4] [--stems]
//
// mix.json (times in seconds of the video):
// {
//   "length": 32,                                   video length (default: the voice length)
//   "voice": "public/vo.wav",                       optional narration / dialogue
//   "music": [ { "file": "public/audio/music/lofi/blue-skies.mp3", "at": 0, "from": 0, "to": 32,
//               "fadeIn": 0.5, "fadeOut": 3, "gain": 0.18 } ],
//   "sfx":   [ { "id": "whoosh/soft-short", "at": 2.4, "vol": 0.4 },             id → file + peak from the index
//              { "file": "public/my/click.wav", "at": 5.0, "vol": 0.3, "peak": 0.01 } ],
//   "beds":  [ { "id": "sfx/ambience/wind", "from": 0, "to": 32, "vol": 0.3 } ],   looped under everything
//   "audioDir": "public/audio"                      where get.mjs saved the files (default)
// }
// "at" is when the effect's PEAK should land (the visible event); the file is placed peak seconds earlier.
// Music gain: 1.0 when there is no voice; ≈0.15–0.2 under a voice (the library is −16 LUFS → ≈−31 LUFS bed).
// Rules baked in: the music is gently ducked by the voice; the whole effects bus is ducked by the voice too,
// so effects never cover the words. --stems writes voice / music / effects separately to check the balance
// (good: voice ≈ −21, music ≈ −31, effects ≈ −38 LUFS).
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const cfgPath = argv[0];
if (!cfgPath || cfgPath.startsWith("--")) { console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n")); process.exit(1); }
const A = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const OUT = flag("out", "out/mix.wav");
const DIR = A.audioDir || "public/audio";
const IDX = path.join(DIR, ".alvana", "index.json");
const I = fs.existsSync(IDX) ? JSON.parse(fs.readFileSync(IDX, "utf8")) : { sfx: [], music: [] };
const LOCAL = path.join(DIR, ".alvana", "local-index.json");
if (fs.existsSync(LOCAL)) { const L = JSON.parse(fs.readFileSync(LOCAL, "utf8")); I.sfx.push(...(L.sfx || [])); }
const resolve = (e) => {
  if (e.file) return { file: e.file, peak: e.peak ?? 0 };
  const x = I.sfx.find((s) => s.id === e.id) || I.music.find((s) => s.id === e.id);
  if (!x) throw new Error(`unknown id ${e.id} — download it first: node get.mjs get ${e.id}`);
  return { file: x.local ? x.path : path.join(DIR, x.file), peak: x.peak ?? 0 };
};
const dur = (f) => +spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim();
const TOTAL = A.length ?? (A.voice ? dur(A.voice) : Math.max(...(A.music || []).map((m) => m.to ?? m.at + dur(resolve(m).file))));
const voice = !!A.voice;
const MUSIC = (A.music || []).map((m) => ({ ...m, ...resolve(m) }));
const SFX = (A.sfx || []).map((s) => ({ ...s, ...resolve(s) }));
const BEDS = (A.beds || []).map((b) => ({ ...b, ...resolve(b) }));

const inputs = [], parts = [];
const T = TOTAL.toFixed(3);
if (voice) { inputs.push(A.voice); parts.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,apad=whole_dur=${T},asplit=3[vo][sc][sc2]`); }
else parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${T}[vo]`);
MUSIC.forEach((m, i) => {
  const k = inputs.push(m.file) - 1, from = m.from ?? 0, at = m.at ?? 0, to = m.to ?? TOTAL, len = Math.max(0.1, to - at);
  const g = m.gain ?? (voice ? 0.18 : 1), fi = m.fadeIn ?? 0.3, fo = m.fadeOut ?? 2;
  parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=${from}:${(from + len).toFixed(3)},asetpts=PTS-STARTPTS,afade=t=in:d=${fi},afade=t=out:st=${Math.max(0, len - fo).toFixed(3)}:d=${fo},volume=${g},adelay=${Math.round(at * 1000)}:all=1[m${i}]`);
});
if (MUSIC.length) {
  parts.push(`${MUSIC.map((_, i) => `[m${i}]`).join("")}amix=inputs=${MUSIC.length}:normalize=0:dropout_transition=0,apad=whole_dur=${T}[mus]`);
  if (voice) parts.push(`[mus][sc]sidechaincompress=threshold=0.05:ratio=2.5:attack=40:release=500:makeup=1[mud]`);
  else parts.push(`[mus]anull[mud]`);
} else { parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${T}[mud]`); if (voice) parts.push(`[sc]anullsink`); }
const fx = [];
SFX.forEach((s, i) => {
  const k = inputs.push(s.file) - 1, ms = Math.max(0, Math.round((s.at - s.peak) * 1000));
  parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${s.vol ?? 0.4},adelay=${ms}:all=1[s${i}]`);
  fx.push(`[s${i}]`);
});
BEDS.forEach((b, i) => {
  const k = inputs.push(b.file) - 1, from = b.from ?? 0, to = b.to ?? TOTAL, len = Math.max(0.1, to - from);
  parts.push(`[${k}:a]aformat=sample_rates=48000:channel_layouts=stereo,aloop=loop=-1:size=2147483647,atrim=0:${len.toFixed(3)},afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, len - 1.5).toFixed(3)}:d=1.5,volume=${b.vol ?? 0.3},adelay=${Math.round(from * 1000)}:all=1[b${i}]`);
  fx.push(`[b${i}]`);
});
if (fx.length) {
  parts.push(`${fx.join("")}amix=inputs=${fx.length}:normalize=0:dropout_transition=0,apad=whole_dur=${T}[fx]`);
  if (voice) parts.push(`[fx][sc2]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350:makeup=1[fxd]`);
  else parts.push(`[fx]anull[fxd]`);
} else { parts.push(`anullsrc=r=48000:cl=stereo,atrim=0:${T}[fxd]`); if (voice) parts.push(`[sc2]anullsink`); }
const stems = argv.includes("--stems");
if (stems) parts.push(`[vo]atrim=0:${T}[o1]`, `[mud]atrim=0:${T}[o2]`, `[fxd]atrim=0:${T}[o3]`);
else parts.push(`[vo][mud][fxd]amix=inputs=3:normalize=0:dropout_transition=0,atrim=0:${T},alimiter=limit=0.95[out]`);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const graph = OUT.replace(/\.wav$/, "") + ".graph.txt";
fs.writeFileSync(graph, parts.join(";\n"));
const outs = stems ? ["o1", "o2", "o3"].flatMap((o, i) => ["-map", `[${o}]`, "-ar", "48000", OUT.replace(/\.wav$/, `-${["voice", "music", "sfx"][i]}.wav`)]) : ["-map", "[out]", "-ar", "48000", OUT];
// the graph is passed as a file so long plans do not overflow the command line (ffmpeg 7+: -/filter_complex)
const major = +((spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).stdout || "").match(/version n?(\d+)/) || [, 6])[1];
const graphArgs = major >= 7 ? ["-/filter_complex", graph] : ["-filter_complex_script", graph];
const ff = spawnSync("ffmpeg", ["-nostdin", "-v", "error", "-y", ...inputs.flatMap((f) => ["-i", f]), ...graphArgs, ...outs], { stdio: "inherit" });
fs.rmSync(graph, { force: true });
if (ff.status !== 0) process.exit(ff.status || 1);
console.log(`mixed ${TOTAL.toFixed(1)} s: ${MUSIC.length} music · ${SFX.length} effects · ${BEDS.length} beds → ${OUT}`);
if (stems) {
  for (const s of ["voice", "music", "sfx"]) {
    const f = OUT.replace(/\.wav$/, `-${s}.wav`), r = spawnSync("ffmpeg", ["-nostdin", "-i", f, "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr;
    console.log(`${s}: ${(r.match(/I:\s+(-?[\d.]+) LUFS/g) || []).pop() || "?"}`);
  }
  process.exit(0);
}
// two-pass loudnorm → −14 LUFS, true peak −1.5
const m = spawnSync("ffmpeg", ["-nostdin", "-i", OUT, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr;
const j = JSON.parse(m.slice(m.lastIndexOf("{"), m.lastIndexOf("}") + 1));
const norm = OUT.replace(/\.wav$/, "-norm.wav");
execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", OUT, "-af", `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`, "-ar", "48000", norm]);
console.log(`loudness ${j.input_i} → −14 LUFS → ${norm}`);
const video = flag("video");
if (video) {
  const fin = flag("final", video.replace(/\.mp4$/, "-final.mp4"));
  execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-y", "-i", video, "-i", norm, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", fin]);
  console.log(`video → ${fin}`);
}
