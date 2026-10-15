// Alvana Audio · where every pack comes from, its licence, and how its file names map to library categories.
// map(stem) → { cat, name, tags? } (name without the category word) or null to skip the file.

export const kebab = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Za-z])(\d)/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .toLowerCase();
const words = (s) => kebab(s).split("-").filter((w) => w && !/^\d+$/.test(w));
const num = (s) => (String(s).match(/(\d+)\s*$/) || [, ""])[1];
const strip = (name, word) => name.replace(new RegExp(`^${word}-?`), "") || name;
const out = (cat, name, tags = []) => ({ cat, name: kebab(name), tags: [...new Set([cat, ...words(name), ...tags])] });

// ---------------------------------------------------------------- Kenney (CC0)
const kenneyCasino = (stem) => {
  if (/^preview/i.test(stem)) return null;
  const t = /^(card|cards)/.test(stem) ? ["card"] : /^chip/.test(stem) ? ["chips", "money"] : ["dice", "game"];
  return out("casino", stem, t);
};
const kenneyDigital = (stem) => {
  if (/^preview/i.test(stem)) return null;
  if (/^(laser|phaser|zap|spaceTrash|phaseJump)/i.test(stem)) return out("scifi", stem, ["sci-fi", "game"]);
  return out("game", stem, ["retro", "blip"]);
};
const kenneyImpact = (stem) => {
  if (/^footstep_/.test(stem)) return out("footsteps", stem.replace(/^footstep_/, ""), ["step", "walk"]);
  const m = /^impact([A-Z][a-z]+)_(\w+?)_(\d+)$/.exec(stem);
  if (m) return out("impact", `${m[1]}-${m[2]}-${m[3]}`, ["hit"]);
  return out("impact", stem.replace(/^impact/, ""), ["hit"]);
};
const kenneyInterface = (stem) => {
  const w = stem.replace(/_\d+$/, ""), n = num(stem);
  if (w === "confirmation") return out("notification", `confirm-${n}`, ["success", "ui"]);
  if (w === "error") return out("notification", `error-${n}`, ["error", "fail", "ui"]);
  if (w === "question") return out("notification", `question-${n}`, ["ui"]);
  if (w === "glitch") return out("glitch", `ui-${n}`, ["digital", "ui"]);
  return out("ui", `${w}-${n}`, ["interface"]);
};
const kenneyJingles = (stem) => {
  if (/^preview/i.test(stem)) return null;
  const m = /^jingles_([A-Z]+)(\d+)$/.exec(stem);
  if (!m) return null;
  const style = { HIT: "hit", NES: "8bit", PIZZI: "pizzicato", SAX: "sax", STEEL: "steel-drum" }[m[1]] || m[1].toLowerCase();
  return out("jingle", `${style}-${m[2]}`, ["sting", "music", style]);
};
const kenneyRpg = (stem) => {
  if (/^preview/i.test(stem)) return null;
  if (/^book/.test(stem)) return out("paper", stem, ["book"]);
  if (/^door/.test(stem)) return out("door", stem.replace(/^door/, ""), ["wood"]);
  if (/^footstep/.test(stem)) return out("footsteps", `rpg-${num(stem)}`, ["step", "walk"]);
  if (/^handleCoins/.test(stem)) return out("money", stem, ["coins"]);
  if (/^metal(Click|Latch)/.test(stem)) return out("mechanical", stem, ["metal"]);
  return out("foley", stem, []);
};
const kenneyScifi = (stem) => {
  const s = stem.replace(/_(\d+)$/, "-$1");
  if (/^computerNoise/.test(stem)) return out("data", s, ["computer", "tech"]);
  if (/^door/.test(stem)) return out("scifi", s, ["door", "sci-fi"]);
  if (/^(engine|spaceEngine|thruster)/.test(stem)) return out("scifi", s, ["engine", "sci-fi"]);
  if (/^(explosion|lowFrequency)/.test(stem)) return out("explosion", s, ["sci-fi", "boom"]);
  if (/^impactMetal/.test(stem)) return out("impact", `scifi-${s.replace(/^impact-?/i, "")}`, ["metal", "sci-fi"]);
  if (/^slime/.test(stem)) return out("water", `slime-scifi-${num(stem)}`, ["slime"]);
  return out("scifi", s, ["sci-fi"]);
};
const kenneyUi = (stem) => {
  if (/^preview/i.test(stem)) return null;
  return out("ui", stem.replace(/^mouse/, "mouse-"), ["interface"]);
};

// ---------------------------------------------------------------- OpenGameArt (CC0)
const oga100 = (stem) => {
  const w = stem.replace(/[_-]?\d+$/, ""), n = num(stem);
  const go = (cat, extra = []) => out(cat, `${w}-${n}`, extra);
  if (/^(door|door_close|door_open|microwave_door_close|microwave_door_open|wooded_box_open)$/.test(w)) return out("door", `${w.replace(/^door_?/, "") || "door"}-${n}`, []);
  if (/^(explosion|shot)$/.test(w)) return go("explosion", w === "shot" ? ["gun"] : ["boom"]);
  if (/^(hit|slam|gong)$/.test(w)) return go("impact");
  if (/^(machine|key_open|switch)$/.test(w)) return go("mechanical");
  if (w === "splash") return go("water");
  if (w === "plop") return go("pop");
  if (w === "paper") return go("paper");
  if (/^(spring|weird|other|noise)$/.test(w)) return go("misc", w === "spring" ? ["cartoon", "boing"] : []);
  return go("foley");
};
const oga100v2 = (stem) => {
  const s = stem.replace(/^sfx100v2_/, ""), w = s.replace(/[_-]?\d+$/, ""), n = num(s);
  const go = (cat, name = `${w}-${n}`, extra = []) => out(cat, name, extra);
  if (w === "air") return go("whoosh", `air-${n}`, ["air"]);
  if (w === "door") return go("door", `door-${n}`);
  if (/^footstep/.test(w)) return go("footsteps", `${w.replace(/^footstep_?/, "") || "step"}-${n}`, ["step"]);
  if (/hit$/.test(w)) return go("impact");
  if (/^loop_/.test(w)) return go("ambience", `${w.replace(/^loop_/, "")}-${n}`, ["loop", "bed"]);
  if (w === "thunder") return go("ambience", `thunder-${n}`, ["weather", "storm"]);
  if (/^(lock_open|switch)$/.test(w)) return go("mechanical");
  if (w === "misc") return go("misc");
  return go("foley");
};
const ogaBreak = (stem) => {
  const s = stem.replace(/^bfh1_/, ""), w = s.replace(/[_-]?\d+$/, ""), n = num(s);
  if (/hit$/.test(w)) return out("impact", `${w}-${n}`, []);
  return out("break", `${w}-${n}`, /falling/.test(w) ? ["fall"] : ["break", "crash"]);
};
const ogaBang = (stem) => {
  const w = stem.replace(/[_-]?\d+$/, ""), n = num(stem);
  if (/^fw/.test(w)) return out("explosion", `firework${w === "fw_loop" ? "-loop" : ""}-${n}`, ["fireworks", "celebration"]);
  return out("explosion", `${w}-${n}`, w === "shot" ? ["gun"] : ["bang", "boom"]);
};
const ogaWater = (stem) => {
  const w = stem.replace(/[_-]?\d+$/, ""), n = num(stem);
  if (/^loop_/.test(w)) return out("ambience", `${w.replace(/^loop_/, "")}-${n}`, ["loop", "bed", "water"]);
  return out("water", `${w}-${n}`, []);
};
const ogaCreature = (stem) => {
  const w = stem.replace(/[_-]?\d+$/, ""), n = num(stem);
  if (/^(breath|burp|cough|eat|nose|snore|spit)$/.test(w)) return out("body", `${w}-${n}`, ["human", "funny"]);
  return out("creature", `${w}-${n}`, ["voice", "monster"]);
};
const ogaSwish = (stem) => (stem.startsWith("._") ? null : out("whoosh", `swish-${num(stem) || "1"}`, ["swish", "fast"]));
const ogaBeep = (stem) => out("ui", `beep-${num(stem) || "1"}`, ["beep", "interface"]);
const ogaKeys = (stem) => out("keyboard", `key-${num(stem)}`, ["typing", "key"]);

// ---------------------------------------------------------------- this library's own synthesized sounds
const CLASSIC = {
  blip: ["ui", ["blip"]], boom: ["impact", ["boom"]], chime: ["notification", ["chime", "success"]], click: ["ui", ["click"]],
  error: ["notification", ["error"]], glitch: ["glitch", ["digital"]], hop: ["pop", ["chirp"]], lock: ["notification", ["lock", "success"]],
  match: ["notification", ["match", "success"]], node1: ["ui", ["note"]], node2: ["ui", ["note"]], node3: ["ui", ["note"]],
  notif: ["notification", ["message"]], paper: ["paper", ["paper"]], pin: ["ui", ["pin"]], ping: ["notification", ["ping"]],
  pop: ["pop", ["pop"]], print: ["mechanical", ["printer"]], riser: ["riser", ["build"]], scan: ["data", ["scan"]],
  servo: ["mechanical", ["servo", "robot"]], stamp: ["impact", ["stamp"]], steps: ["footsteps", ["walk"]], stop: ["notification", ["stop"]],
  strike: ["ui", ["strike", "zap"]], string: ["ui", ["pluck", "string"]], sweep: ["whoosh", ["sweep", "tone"]], thud: ["impact", ["thud"]],
  ticks: ["mechanical", ["ticks", "timer"]], type: ["keyboard", ["typing"]], whoosh: ["whoosh", ["air"]],
};
const classic = (stem) => { const c = CLASSIC[stem]; return c ? out(c[0], `classic-${stem}`, c[1]) : null; };

export const SFX_PACKS = [
  { key: "kenney-casino", dir: "kenney/kenney_casino-audio", author: "Kenney", url: "https://kenney.nl/assets/casino-audio", lic: "CC0-1.0", map: kenneyCasino },
  { key: "kenney-digital", dir: "kenney/kenney_digital-audio", author: "Kenney", url: "https://kenney.nl/assets/digital-audio", lic: "CC0-1.0", map: kenneyDigital },
  { key: "kenney-impact", dir: "kenney/kenney_impact-sounds", author: "Kenney", url: "https://kenney.nl/assets/impact-sounds", lic: "CC0-1.0", map: kenneyImpact },
  { key: "kenney-interface", dir: "kenney/kenney_interface-sounds", author: "Kenney", url: "https://kenney.nl/assets/interface-sounds", lic: "CC0-1.0", map: kenneyInterface },
  { key: "kenney-jingles", dir: "kenney/kenney_music-jingles", author: "Kenney", url: "https://kenney.nl/assets/music-jingles", lic: "CC0-1.0", map: kenneyJingles },
  { key: "kenney-rpg", dir: "kenney/kenney_rpg-audio", author: "Kenney", url: "https://kenney.nl/assets/rpg-audio", lic: "CC0-1.0", map: kenneyRpg },
  { key: "kenney-scifi", dir: "kenney/kenney_sci-fi-sounds", author: "Kenney", url: "https://kenney.nl/assets/sci-fi-sounds", lic: "CC0-1.0", map: kenneyScifi },
  { key: "kenney-ui", dir: "kenney/kenney_ui-audio", author: "Kenney", url: "https://kenney.nl/assets/ui-audio", lic: "CC0-1.0", map: kenneyUi },
  { key: "oga-100-sfx", dir: "oga/100-CC0-SFX_0", author: "rubberduck", url: "https://opengameart.org/content/100-cc0-sfx", lic: "CC0-1.0", map: oga100 },
  { key: "oga-100-sfx-2", dir: "oga/sfx_100_v2", author: "rubberduck", url: "https://opengameart.org/content/100-cc0-sfx-2", lic: "CC0-1.0", map: oga100v2 },
  { key: "oga-breaking", dir: "oga/sfx_breaking_and_falling", author: "rubberduck", url: "https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx", lic: "CC0-1.0", map: ogaBreak },
  { key: "oga-bang", dir: "oga/25-CC0-bang-sfx", author: "rubberduck", url: "https://opengameart.org/content/25-cc0-bang-firework-sfx", lic: "CC0-1.0", map: ogaBang },
  { key: "oga-water", dir: "oga/water-splash-slime-sfx", author: "rubberduck", url: "https://opengameart.org/content/40-cc0-water-splash-slime-sfx", lic: "CC0-1.0", map: ogaWater },
  { key: "oga-creature", dir: "oga/80-CC0-creature-SFX_0", author: "rubberduck", url: "https://opengameart.org/content/80-cc0-creature-sfx", lic: "CC0-1.0", map: ogaCreature },
  { key: "oga-swishes", dir: "oga/swishes", author: "artisticdude", url: "https://opengameart.org/content/swishes-sound-pack", lic: "CC0-1.0", map: ogaSwish },
  { key: "oga-beeps", dir: "oga/beeps", author: "bart", url: "https://opengameart.org/content/interface-beeps", lic: "CC0-1.0", map: ogaBeep },
  { key: "oga-keyboard", dir: "local/keyboard", author: "unicaegames", url: "https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes", lic: "CC0-1.0", map: ogaKeys },
  { key: "alvana-classic", dir: "local/sfx-lib", author: "Alvana (synthesized for this library)", url: "", lic: "CC0-1.0", map: classic },
  { key: "alvana-synth", dir: "synth", author: "Alvana (synthesized for this library)", url: "", lic: "CC0-1.0", meta: "synth-meta.json" },
];

// ---------------------------------------------------------------- music
const H = (dir, mood, album, tags, url) => ({ dir: `holizna/${dir}`, mood, album, tags, url: `https://opengameart.org/content/${url}` });
export const MUSIC_SETS = [
  H("happy_lo-fi_lofi_collection", "lofi", "Happy Lo-Fi", ["lofi", "happy", "warm", "vlog"], "happy-lo-fi-lofi-collection"),
  H("lo-fi_and_chill_lofi_collection", "lofi", "Lo-Fi And Chill", ["lofi", "chill", "study", "calm"], "lo-fi-and-chill-collection"),
  H("lo-fi_and_chill_lofi_collection_2", "lofi", "Lo-Fi And Chill", ["lofi", "chill", "study", "calm"], "lo-fi-and-chill-collection"),
  H("lo-fi_and_chill_lofi_collection_3", "lofi", "Lo-Fi And Chill", ["lofi", "chill", "study", "calm"], "lo-fi-and-chill-collection"),
  H("chill_beats", "lofi", "Chill Beats", ["lofi", "beats", "chill"], "chill-beats-collection"),
  H("sad_lofi_1", "sad", "Sad Lo-Fi", ["lofi", "sad", "emotional", "melancholy"], "sad-lo-fi-lofi-collectioni"),
  H("sad_lofi_2", "sad", "Sad Lo-Fi", ["lofi", "sad", "emotional", "melancholy"], "sad-lo-fi-lofi-collectioni"),
  H("chillout_instrumentals", "chill", "Chillout Instrumentals", ["chill", "instrumental", "warm", "vlog"], "chillout-instrumentals-collection"),
  H("relaxing_instrumentals", "calm", "Relaxing Instrumentals", ["calm", "emotional", "soft", "instrumental"], "relaxing-instrumentals-collection"),
  H("title_screens", "intro", "Title Screens (Beginnings)", ["intro", "piano", "calm", "cinematic"], "title-screens-beginnings-collection"),
  H("happy_electronic", "upbeat", "Happy Pop Electronic", ["electronic", "pop", "happy", "energetic"], "happy-pop-electronic-collection"),
  H("funk_collection_", "funk", "Funk", ["funk", "groovy", "upbeat", "fun"], "funk-collection"),
  H("gamer_beats", "hiphop", "Gamer Beats", ["hiphop", "beats", "gaming", "energetic"], "gamer-beats-collection"),
  H("retro_wave_1", "synthwave", "Retro Wave", ["synthwave", "80s", "retro", "driving", "tech"], "retro-wave-collection"),
  H("retro_wave_2", "synthwave", "Retro Wave", ["synthwave", "80s", "retro", "driving", "tech"], "retro-wave-collection"),
  H("scifi", "scifi", "Sci-Fi", ["sci-fi", "space", "tech", "mystery"], "scifi-collection"),
  H("caves_zip_0", "ambient", "Caves", ["ambient", "dark", "mystery", "drone"], "caves-collection"),
  H("quiet_village", "ambient", "Quiet Village", ["ambient", "fantasy", "calm", "nature"], "quiet-village-collection"),
  H("haunted_mansion", "horror", "Haunted Mansion", ["horror", "creepy", "dark", "mystery"], "haunted-mansion-collection"),
  H("horror_beats", "horror", "Horror Beats", ["horror", "tension", "dark", "beats"], "horror-beats-collection"),
  H("horror_beats_2", "horror", "Horror Beats", ["horror", "tension", "dark", "beats"], "horror-beats-collection"),
  H("game_over", "dark", "Game Over", ["dark", "sad", "ending", "short"], "game-over-collection"),
  H("action_chiptune", "chiptune", "Action Chiptunes", ["8-bit", "game", "retro", "action", "energetic"], "adventure-chiptunes-collection"),
  H("chill_chiptunes", "chiptune", "Chill Chiptunes", ["8-bit", "game", "retro", "chill"], "chill-chiptunes-collection"),
  H("happy_chiptunes", "chiptune", "Happy Chiptunes", ["8-bit", "game", "happy", "cute"], "happy-chiptunes-collection"),
  H("gameboi_zip_0", "chiptune", "Game Boi", ["8-bit", "gameboy", "retro"], "game-boi-collection"),
].map((s) => ({ ...s, artist: "HoliznaCC0", lic: "CC0-1.0", key: `holizna-${s.dir.split("/")[1]}` }));

export const ENDE = {
  dir: "local/ende",
  artist: "Sascha Ende",
  url: "https://ende.app",
  lic: "CC-BY-4.0",
  mood: "corporate",
  tracks: {
    "happy-beats-business-moves-vol-1-by-ende-dot-app": { title: "Happy Beats Business Moves Vol. 1", tags: ["corporate", "upbeat", "energetic", "business"] },
    "happy-beats-business-moves-vol-9-by-ende-dot-app": { title: "Happy Beats Business Moves Vol. 9", tags: ["corporate", "calm", "business", "explainer"] },
    "happy-beats-business-moves-vol-10-by-ende-dot-app": { title: "Happy Beats Business Moves Vol. 10", tags: ["corporate", "punchy", "loop", "business"] },
    "happy-beats-business-moves-vol-11-by-ende-dot-app": { title: "Happy Beats Business Moves Vol. 11", tags: ["corporate", "warm", "business"] },
    "happy-beats-business-moves-vol-12-by-ende-dot-app": { title: "Happy Beats Business Moves Vol. 12", tags: ["corporate", "steady", "explainer", "business"] },
  },
};
