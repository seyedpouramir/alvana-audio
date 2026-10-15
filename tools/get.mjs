#!/usr/bin/env node
// Alvana Audio · search the library and download only the files you need (no clone, no dependencies; Node 18+).
//
//   node get.mjs list                                   categories / moods with counts
//   node get.mjs search <words…> [filters]              best matches, one line each (Persian words work too)
//        filters: --type sfx|music  --cat <c>  --mood <m>  --max 15  --dur 0.2-1.5  --bpm 90-120
//                 --intensity low|mid|high  --start instant|builds  --tone warm|balanced|bright
//   node get.mjs get <id…> [--to public/audio]          download files (+ the cue file of a track) → prints paths
//   node get.mjs pack <cat|mood> [--max 30] [--to …]    download a whole category / mood
//   node get.mjs info <id>                              full metadata (a track: drops, breaks, first bars)
//   node get.mjs credits [--to public/audio]            CREDITS-audio.md for everything you downloaded
//   add --local <local-index.json> to search your own private packs too (see tools/index-local.mjs)
//   add --from <folder> (or ALVANA_AUDIO_DIR) to copy from a downloaded / cloned copy of the library instead
//
// Downloads try raw.githubusercontent.com, then a sparse git checkout through github.com (works where raw is
// blocked). Respects HTTPS_PROXY / ALL_PROXY through curl.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";

const REPO = { owner: "seyedpouramir", repo: "alvana-audio", branch: "main" };
const RAW = (f) => `https://raw.githubusercontent.com/${REPO.owner}/${REPO.repo}/${REPO.branch}/${f}`;
const GIT = `https://github.com/${REPO.owner}/${REPO.repo}.git`;

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const positional = argv.slice(1).filter((a, i, arr) => !a.startsWith("--") && !(i > 0 && arr[i - 1].startsWith("--") && !["refresh"].includes(arr[i - 1].slice(2))));
const TO = flag("to", "public/audio");
const FROM = flag("from", process.env.ALVANA_AUDIO_DIR || "");
const CACHE = path.join(os.homedir(), ".cache", "alvana-audio");
fs.mkdirSync(CACHE, { recursive: true });

// ---------------------------------------------------------------- download helpers
const hasCurl = spawnSync("curl", ["--version"], { stdio: "ignore" }).status === 0;
async function fetchTo(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  if (hasCurl) {
    const r = spawnSync("curl", ["-fsSL", "--retry", "2", "--connect-timeout", "15", "--max-time", "300", "-o", tmp, url], { stdio: ["ignore", "ignore", "pipe"] });
    if (r.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 0) { fs.renameSync(tmp, dest); return true; }
    fs.rmSync(tmp, { force: true });
    return false;
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(300000) });
    if (!res.ok) return false;
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
    fs.renameSync(tmp, dest);
    return true;
  } catch { fs.rmSync(tmp, { force: true }); return false; }
}
/** sparse checkout of just these paths through github.com (fallback when raw.githubusercontent.com is blocked) */
function gitFetch(files) {
  const dir = path.join(CACHE, "git");
  const git = (...a) => spawnSync("git", ["-C", dir, ...a], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync("git", ["clone", "--filter=blob:none", "--no-checkout", "--depth", "1", "--branch", REPO.branch, GIT, dir], { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
    if (r.status !== 0) { console.error("git clone failed:", (r.stderr || "").trim().split("\n").pop()); return null; }
    git("sparse-checkout", "init", "--no-cone");
  } else git("pull", "--depth", "1", "--ff-only");
  const want = new Set((git("sparse-checkout", "list").stdout || "").split("\n").filter(Boolean));
  files.forEach((f) => want.add("/" + f));
  git("sparse-checkout", "set", "--no-cone", ...want);
  const r = git("checkout", REPO.branch);
  if (r.status !== 0) { console.error("git checkout failed:", (r.stderr || "").trim().split("\n").pop()); return null; }
  return dir;
}
async function getFiles(files, destRoot) {
  if (FROM) {
    for (const f of files) {
      const src = path.join(FROM, f), dest = path.join(destRoot, f);
      if (!fs.existsSync(src)) { console.error(`✗ not in ${FROM}: ${f}`); continue; }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    return;
  }
  const missing = [];
  for (const f of files) {
    const dest = path.join(destRoot, f);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) continue;
    if (!(await fetchTo(RAW(f), dest))) missing.push(f);
  }
  if (missing.length) {
    console.error(`raw.githubusercontent.com failed for ${missing.length} file(s) — trying git through github.com…`);
    const dir = gitFetch(missing);
    for (const f of missing) {
      const src = dir && path.join(dir, f);
      if (src && fs.existsSync(src)) { fs.mkdirSync(path.dirname(path.join(destRoot, f)), { recursive: true }); fs.copyFileSync(src, path.join(destRoot, f)); }
      else console.error(`✗ could not download ${f} (check the network / proxy: HTTPS_PROXY=http://host:port)`);
    }
  }
}

// ---------------------------------------------------------------- index (cached for a day)
async function index() {
  const f = path.join(CACHE, "index.json");
  if (FROM) fs.copyFileSync(path.join(FROM, "index.json"), f);
  const fresh = !!FROM || fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs < 86400e3 && !has("refresh");
  if (!fresh) {
    const ok = await fetchTo(RAW("index.json"), f + ".new");
    if (ok) fs.renameSync(f + ".new", f);
    else if (!fs.existsSync(f)) { const dir = gitFetch(["index.json"]); if (dir) fs.copyFileSync(path.join(dir, "index.json"), f); }
  }
  if (!fs.existsSync(f)) { console.error("could not load index.json"); process.exit(1); }
  const I = JSON.parse(fs.readFileSync(f, "utf8"));
  const local = flag("local", fs.existsSync(path.join(TO, ".alvana", "local-index.json")) ? path.join(TO, ".alvana", "local-index.json") : null);
  if (local && fs.existsSync(local)) {
    const L = JSON.parse(fs.readFileSync(local, "utf8"));
    for (const s of L.sfx || []) I.sfx.push({ ...s, local: true });
    for (const m of L.music || []) I.music.push({ ...m, local: true });
  }
  return I;
}

// ---------------------------------------------------------------- search
const FA = {
  "ووش": "whoosh", "وش": "whoosh", "سوییش": "swish", "ترنزیشن": "transition", "انتقال": "transition", "رایزر": "riser", "اوج": "riser",
  "ضربه": "impact", "برخورد": "impact", "بوم": "boom", "انفجار": "explosion", "ترقه": "fireworks", "آتش‌بازی": "fireworks", "تیر": "gun",
  "کلیک": "click", "دکمه": "button", "سوییچ": "switch", "تاگل": "toggle", "پاپ": "pop", "حباب": "bubble", "اعلان": "notification",
  "نوتیف": "notification", "پیام": "message", "زنگ": "bell", "موفقیت": "success", "درست": "success", "خطا": "error", "اشتباه": "error",
  "گلیچ": "glitch", "دیجیتال": "digital", "داده": "data", "کامپیوتر": "computer", "هوش": "ai", "اسکن": "scan", "رادار": "radar",
  "تایپ": "typing", "کیبورد": "keyboard", "دوربین": "camera", "شاتر": "shutter", "عکس": "photo", "دنده": "gear", "چرخ‌دنده": "gear",
  "ساعت": "clock", "تیک": "tick", "قلب": "heart", "جادو": "magic", "درخشش": "sparkle", "پول": "money", "سکه": "coin", "صندوق": "cash",
  "کاغذ": "paper", "کتاب": "book", "ورق": "page", "در": "door", "قدم": "step", "پا": "footsteps", "شیشه": "glass", "شکستن": "break",
  "افتادن": "fall", "آب": "water", "باران": "rain", "باد": "wind", "رعد": "thunder", "شب": "night", "جیرجیرک": "crickets", "اتاق": "room",
  "خیابان": "highway", "ماشین": "machine", "هیولا": "monster", "حیوان": "creature", "بامزه": "funny", "کارتونی": "cartoon", "بازی": "game",
  "جینگل": "jingle", "استینگ": "sting", "لیزر": "laser", "فضایی": "sci-fi", "فضا": "space", "علمی‌تخیلی": "sci-fi",
  "شاد": "happy", "غمگین": "sad", "آرام": "calm", "آروم": "calm", "هیجانی": "energetic", "پرانرژی": "energetic", "لوفای": "lofi",
  "چیل": "chill", "ترسناک": "horror", "وحشت": "horror", "تاریک": "dark", "تعلیق": "tension", "حماسی": "epic", "سینمایی": "cinematic",
  "اینترو": "intro", "پیانو": "piano", "رترو": "retro", "فانک": "funk", "هیپ‌هاپ": "hiphop", "رپ": "hiphop", "شرکتی": "corporate",
  "تبلیغ": "corporate", "تبلیغاتی": "corporate", "مستند": "calm", "ولاگ": "vlog", "گیم": "game", "هشت‌بیتی": "8-bit", "الکترونیک": "electronic",
  "مرموز": "mystery", "رمز": "mystery", "احساسی": "emotional", "عاشقانه": "love",
  "نرم": "soft", "ملایم": "soft", "سریع": "fast", "تند": "fast", "آهسته": "slow", "کند": "slow", "کوتاه": "short", "بلند": "long",
  "عمیق": "deep", "بم": "low", "سنگین": "heavy", "سبک": "light", "قوی": "heavy", "روشن": "bright", "گرم": "warm", "فلزی": "metal",
  "چوبی": "wood", "لوپ": "loop", "تکراری": "loop", "بیس": "bass", "دراپ": "drop", "شروع": "intro", "پایان": "ending", "معکوس": "reverse",
};
const norm = (w) => { const k = w.toLowerCase().replace(/[‌\s]+/g, ""); return FA[w] || FA[k] || k; };
const range = (s) => (s ? s.split("-").map(Number) : null);
function search(I) {
  const words = positional.map(norm).filter(Boolean);
  const type = flag("type"), cat = flag("cat"), mood = flag("mood"), max = +flag("max", 15);
  const dur = range(flag("dur")), bpm = range(flag("bpm")), inten = flag("intensity"), start = flag("start"), tone = flag("tone");
  let pool = [...(type !== "music" ? I.sfx.map((x) => ({ ...x, type: "sfx" })) : []), ...(type !== "sfx" ? I.music.map((x) => ({ ...x, type: "music" })) : [])];
  pool = pool.filter((x) => (!cat || x.cat === cat) && (!mood || x.mood === mood) && (!dur || (x.dur >= dur[0] && x.dur <= (dur[1] ?? 1e9)))
    && (!bpm || (x.bpm >= bpm[0] && x.bpm <= (bpm[1] ?? 1e9))) && (!inten || x.intensity === inten) && (!start || x.start === start) && (!tone || x.tone === tone));
  const scored = pool.map((x) => {
    const hay = [x.id, x.title || "", x.album || "", ...(x.tags || [])].join(" ").toLowerCase();
    let s = 0;
    for (const w of words) { if ((x.tags || []).includes(w) || x.cat === w || x.mood === w) s += 3; else if (hay.includes(w)) s += 1; }
    return [s, x];
  }).filter(([s]) => !words.length || s > 0).sort((a, b) => b[0] - a[0] || (b[1].title && !b[1].artist ? 1 : 0) - (a[1].title && !a[1].artist ? 1 : 0) || (a[1].dur ?? 0) - (b[1].dur ?? 0));
  if (!scored.length) return console.log("no match — try fewer words, or: node get.mjs list");
  for (const [, x] of scored.slice(0, max)) console.log(line(x));
  if (scored.length > max) console.log(`… ${scored.length - max} more (raise --max or add words / filters)`);
}
const line = (x) => x.type === "music" || x.mood
  ? `${x.id} | ${fmt(x.dur)} | ${x.bpm} bpm | ${x.intensity} | starts ${x.start} | ${x.title} — ${x.artist} | ${x.lic}${x.local ? " | LOCAL" : ""}`
  : `${x.id} | ${x.dur}s | peak ${x.peak}s | ${x.tone}${x.bed ? " | loop" : ""} | ${(x.tags || []).slice(0, 5).join(",")}${x.local ? " | LOCAL" : ""}`;
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// ---------------------------------------------------------------- commands
const I = cmd && cmd !== "help" ? await index() : null;
const byId = (id) => { id = String(id).replace(/\.(wav|mp3|json)$/i, ""); const f = (k) => I.sfx.find((x) => x.id === k) || I.music.find((x) => x.id === k); return f(id) || f(`sfx/${id}`) || f(`music/${id}`); };
const remember = (items) => {
  const f = path.join(TO, ".alvana", "downloaded.json");
  const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : [];
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify([...new Set([...prev, ...items.map((x) => x.id)])]));
  fs.copyFileSync(path.join(CACHE, "index.json"), path.join(TO, ".alvana", "index.json"));
};
async function download(items) {
  const remote = items.filter((x) => !x.local);
  const files = remote.flatMap((x) => (x.cues ? [x.file, x.cues] : [x.file]));
  await getFiles(files, TO);
  for (const x of items) {
    const p = x.local ? x.path : path.join(TO, x.file).split(path.sep).join("/");
    console.log(x.mood ? `${p} | ${fmt(x.dur)} | ${x.bpm} bpm | cues: ${x.cues ? path.join(TO, x.cues).split(path.sep).join("/") : "-"}` : `${p} | peak ${x.peak}s | ${x.dur}s`);
  }
  remember(items);
}
if (!cmd || cmd === "help") {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
} else if (cmd === "list") {
  const count = (arr, k) => arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {});
  console.log("SFX  " + Object.entries(count(I.sfx, "cat")).sort().map(([k, v]) => `${k} ${v}`).join(" · "));
  console.log("MUSIC " + Object.entries(count(I.music, "mood")).sort().map(([k, v]) => `${k} ${v}`).join(" · "));
} else if (cmd === "search") search(I);
else if (cmd === "info") {
  const x = byId(positional[0]);
  if (!x) { console.log("unknown id"); process.exit(1); }
  console.log(JSON.stringify(x, null, 1));
  if (x.cues) {
    const c = path.join(CACHE, "cues", x.cues);
    if (!fs.existsSync(c)) await getFiles([x.cues], path.join(CACHE, "cues"));
    if (fs.existsSync(c)) {
      const j = JSON.parse(fs.readFileSync(c, "utf8"));
      console.log(`bars (first 12): ${j.bars.slice(0, 12).join(", ")}\ndrops: ${j.drops.join(", ") || "-"} · breaks: ${j.breaks.join(", ") || "-"} · intro ends ${j.intro_end} · outro from ${j.outro_start ?? "-"}`);
    }
  }
} else if (cmd === "get") {
  const items = positional.map((id) => byId(id) || (console.error(`unknown id: ${id}`), null)).filter(Boolean);
  await download(items);
} else if (cmd === "pack") {
  const k = positional[0], max = +flag("max", 30);
  const items = [...I.sfx.filter((x) => x.cat === k), ...I.music.filter((x) => x.mood === k)].slice(0, max);
  if (!items.length) console.log("unknown category / mood — node get.mjs list");
  else await download(items);
} else if (cmd === "credits") {
  const f = path.join(TO, ".alvana", "downloaded.json");
  const ids = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : [];
  const items = ids.map(byId).filter(Boolean);
  const src = I.sources || {};
  const lines = ["# Audio credits", "", "Sound effects and music from Alvana Audio — https://github.com/" + `${REPO.owner}/${REPO.repo}`, ""];
  const by = items.reduce((m, x) => ((m[x.pack] ||= []).push(x), m), {});
  for (const [k, arr] of Object.entries(by)) {
    const s = src[k] || {};
    lines.push(`- ${s.title || k} — ${s.author || "?"} ${s.url ? `(${s.url})` : ""} — ${s.lic || arr[0].lic}${s.lic === "CC-BY-4.0" ? " — credit required:" : ""}`);
    if (s.lic === "CC-BY-4.0") for (const x of arr) lines.push(`  - "${x.title}" by ${x.artist} (${s.url}), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/); loudness-normalised by Alvana Audio`);
  }
  fs.mkdirSync(TO, { recursive: true });
  fs.writeFileSync(path.join(TO, "CREDITS-audio.md"), lines.join("\n") + "\n");
  console.log(`${items.length} items → ${path.join(TO, "CREDITS-audio.md")}`);
} else {
  console.log("unknown command — node get.mjs help");
}
