// Alvana Audio · write index.json, index/<group>.json and the human catalogue (CATALOG.md + catalog/*.md)
// from the merged build. Usage: node tools/build/docs.mjs <repoRoot> <merged.json> <owner>
import fs from "node:fs";
import path from "node:path";
import { SFX_PACKS, MUSIC_SETS, ENDE } from "./sources.mjs";

const [REPO, MERGED, OWNER = "OWNER"] = process.argv.slice(2);
const M = JSON.parse(fs.readFileSync(MERGED, "utf8"));
const W = (f, s) => { fs.mkdirSync(path.dirname(path.join(REPO, f)), { recursive: true }); fs.writeFileSync(path.join(REPO, f), s); };
const RAW = `https://raw.githubusercontent.com/${OWNER}/alvana-audio/main/`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------- sources
const sources = {};
for (const P of SFX_PACKS) {
  const t = P.key.startsWith("kenney") ? `Kenney · ${P.url.split("/").pop().replace(/-/g, " ")}` : P.key.startsWith("oga") ? `OpenGameArt · ${P.url.split("/").pop().replace(/-/g, " ")}` : P.key === "alvana-synth" ? "Alvana synthesized effects" : "Alvana classic synthesized effects";
  sources[P.key] = { title: t, author: P.author, url: P.url, lic: P.lic };
}
for (const S of MUSIC_SETS) sources[S.key] = { title: `HoliznaCC0 · ${S.album}`, author: "HoliznaCC0", url: S.url, lic: "CC0-1.0" };
sources.ende = { title: "ende.app · Happy Beats Business Moves", author: ENDE.artist, url: ENDE.url, lic: "CC-BY-4.0" };

// ---------------------------------------------------------------- music intensity: library tertiles of beat density + tempo
const music = M.music.map((m) => {
  const c = JSON.parse(fs.readFileSync(path.join(REPO, m.file.replace(/\.mp3$/, ".json")), "utf8"));
  return { ...m, cues: m.file.replace(/\.mp3$/, ".json"), _d: (c.kicks.length + c.snares.length) / Math.max(1, m.dur) };
});
const z = (arr, k) => { const v = arr.map((x) => x[k]), mu = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) || 1; return (x) => (x[k] - mu) / sd; };
const zd = z(music, "_d"), zb = z(music, "bpm");
const score = music.map((x) => 0.6 * zd(x) + 0.4 * zb(x)).sort((a, b) => a - b);
const t1 = score[Math.floor(score.length / 3)], t2 = score[Math.floor((2 * score.length) / 3)];
for (const x of music) { const s = 0.6 * zd(x) + 0.4 * zb(x); x.intensity = s < t1 ? "low" : s < t2 ? "mid" : "high"; delete x._d; }

// ---------------------------------------------------------------- index.json
const noext = (f) => f.replace(/\.[^.]+$/, "");
const sfx = M.sfx.map((s) => ({
  id: noext(s.file), file: s.file, cat: s.cat, ...(s.title ? { title: s.title } : {}), tags: s.tags, dur: s.dur, peak: s.peak, tone: s.tone,
  ...(s.bed ? { bed: true } : {}), ch: s.ch, pack: s.pack, lic: sources[s.pack]?.lic || "CC0-1.0",
}));
const mus = music.map((m) => ({
  id: noext(m.file), file: m.file, cues: m.cues, title: m.title, artist: m.artist, album: m.album, mood: m.mood, tags: m.tags, dur: m.dur, bpm: m.bpm,
  intensity: m.intensity, start: m.start, ending: m.ending, lufs: m.lufs, pack: m.pack, lic: m.lic,
}));
const levels = { sfx: "one-shots: active RMS −20 dBFS, peak ≤ −1 dBFS · loops (bed): RMS −26 dBFS", music: "−16 LUFS integrated, true peak ≤ −1 dBTP" };
const index = { name: "alvana-audio", version: 1, built: new Date().toISOString().slice(0, 10), repo: { owner: OWNER, repo: "alvana-audio", branch: "main" }, levels, sources, sfx, music: mus };
W("index.json", JSON.stringify(index));

// per group (small files Claude can read without loading everything)
const groupS = sfx.reduce((m, s) => ((m[s.cat] ||= []).push(s), m), {});
const groupM = mus.reduce((m, s) => ((m[s.mood] ||= []).push(s), m), {});
for (const [k, arr] of Object.entries(groupS)) W(`index/sfx-${k}.json`, JSON.stringify(arr));
for (const [k, arr] of Object.entries(groupM)) W(`index/music-${k}.json`, JSON.stringify(arr));

// ---------------------------------------------------------------- catalogue
const DESC_S = {
  whoosh: "Air past the camera — transitions, swipes, fast moves", riser: "Build-ups, downlifters — into a cut or a reveal",
  impact: "Hits, booms, thumps, sub drops — reveals and hard cuts", transition: "Whoosh+hit, reverse swells, power up/down",
  ui: "Clicks, toggles, switches, open/close, beeps", notification: "Dings, success, error, message, countdown",
  pop: "Pops, plops, bubbles — things appearing", glitch: "Digital glitches and static", data: "Computer thinking, scans, HUD pings, transfers",
  keyboard: "Single key presses and typing", camera: "Camera shutters", mechanical: "Gears, ratchets, clockwork, switches, machines",
  money: "Coins, cash register", casino: "Cards, chips, dice", paper: "Paper, pages, books", door: "Doors and lids", footsteps: "Steps on many surfaces",
  foley: "Everyday objects: cloth, metal, glass, wood, tools, kitchen", break: "Breaking, falling, crashing", water: "Splashes, bubbles, slime",
  explosion: "Explosions, bangs, guns, fireworks", scifi: "Lasers, zaps, engines, force fields, sci-fi doors", game: "Retro game blips and power-ups",
  jingle: "Short musical stings (success, fail, transitions)", magic: "Sparkles, shimmer", creature: "Creature and monster voices",
  body: "Heartbeats and human body sounds", ambience: "Seamless loops: wind, room tone, crickets, rain, highway, machines", misc: "Odd and cartoon-ish sounds",
};
const DESC_M = {
  lofi: "Lo-fi beats: warm, chill, study, vlogs", sad: "Sad lo-fi: emotional, melancholy", chill: "Chillout instrumentals",
  calm: "Relaxing, soft, emotional instrumentals", intro: "Title screens: calm piano-led beginnings", upbeat: "Happy pop electronic — energetic",
  funk: "Groovy funk", hiphop: "Hip-hop gamer beats", synthwave: "Retro wave / 80s synth, driving, tech", scifi: "Sci-fi: space, tech, mystery",
  ambient: "Ambient: caves, quiet village, drones", horror: "Horror and tension", dark: "Dark short endings (game over)",
  chiptune: "8-bit chiptunes", corporate: "Corporate / explainer beds (CC BY 4.0 — credit required)",
};
const sfxCats = Object.keys(groupS).sort(), moods = Object.keys(groupM).sort();
let cat = `# Catalogue\n\n**${sfx.length} sound effects** in ${sfxCats.length} categories · **${mus.length} music tracks** (${Math.round(mus.reduce((a, m) => a + m.dur, 0) / 60)} minutes) in ${moods.length} moods.\n\n`;
cat += "Listen first: every category has a preview reel (all its sounds one after another).\n\n## Sound effects\n\n| category | count | what | preview | list |\n|---|---:|---|---|---|\n";
for (const k of sfxCats) cat += `| ${k} | ${groupS[k].length} | ${DESC_S[k] || ""} | [▶ listen](previews/sfx-${k}.mp3) | [list](catalog/sfx-${k}.md) |\n`;
cat += "\n## Music\n\n| mood | tracks | what | preview | list |\n|---|---:|---|---|---|\n";
for (const k of moods) cat += `| ${k} | ${groupM[k].length} | ${DESC_M[k] || ""} | [▶ listen](previews/music-${k}.mp3) | [list](catalog/music-${k}.md) |\n`;
W("CATALOG.md", cat);
for (const k of sfxCats) {
  let s = `# Sound effects · ${k}\n\n${DESC_S[k] || ""}\n\n[▶ preview reel](../previews/sfx-${k}.mp3) — the sounds play in this order.\n\n| # | id | sec | peak at | tone | tags | file |\n|---:|---|---:|---:|---|---|---|\n`;
  groupS[k].forEach((x, i) => { s += `| ${i + 1} | \`${x.id}\` | ${x.dur} | ${x.peak} | ${x.tone}${x.bed ? " · loop" : ""} | ${x.tags.slice(0, 6).join(", ")} | [wav](../${x.file}) |\n`; });
  W(`catalog/sfx-${k}.md`, s);
}
for (const k of moods) {
  let s = `# Music · ${k}\n\n${DESC_M[k] || ""}\n\n[▶ preview reel](../previews/music-${k}.mp3) — ~12 s of each track, in this order.\n\n| # | id | title | length | bpm | intensity | starts | album | file |\n|---:|---|---|---:|---:|---|---|---|---|\n`;
  groupM[k].forEach((x, i) => { s += `| ${i + 1} | \`${x.id}\` | ${x.title} | ${fmt(x.dur)} | ${Math.round(x.bpm)} | ${x.intensity} | ${x.start} | ${x.album} | [mp3](../${x.file}) |\n`; });
  W(`catalog/music-${k}.md`, s);
}
const totalMin = Math.round(mus.reduce((a, m) => a + m.dur, 0) / 60);
W("tools/build/.stats.json", JSON.stringify({ sfx: sfx.length, sfxCats: sfxCats.length, music: mus.length, moods: moods.length, minutes: totalMin, groupS: Object.fromEntries(sfxCats.map((k) => [k, groupS[k].length])), groupM: Object.fromEntries(moods.map((k) => [k, groupM[k].length])) }, null, 1));
console.log(`index: ${sfx.length} effects · ${mus.length} tracks (${totalMin} min) · raw base ${RAW}`);
