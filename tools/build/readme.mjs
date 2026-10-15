// Alvana Audio · README.md from tools/build/README.template.md + the numbers of the last build.
// Usage: node tools/build/readme.mjs <repoRoot> <sizeLabelFa> <sizeLabelEn>
import fs from "node:fs";
import path from "node:path";

const [REPO, SIZE_FA = "", SIZE_EN = ""] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(path.join(REPO, "tools/build/.stats.json"), "utf8"));
const T = fs.readFileSync(path.join(REPO, "tools/build/README.template.md"), "utf8");
const faNum = (s) => String(s).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const prev = (g, t) => Object.keys(g).sort().map((k) => `[${k}](previews/${t}-${k}.mp3)`).join(" · ");
const previews = `**افکت‌ها:** ${prev(S.groupS, "sfx")}\n\n**موزیک:** ${prev(S.groupM, "music")}`;
const [fa, en] = T.split("## English");
const fill = (s, num, size) => s
  .replace(/{{SFX}}/g, num === String ? S.sfx.toLocaleString("en-US") : num(S.sfx)).replace(/{{CATS}}/g, num(S.sfxCats)).replace(/{{TRACKS}}/g, num(S.music))
  .replace(/{{MOODS}}/g, num(S.moods)).replace(/{{MIN}}/g, num(S.minutes)).replace(/{{SIZE}}/g, size).replace(/{{PREVIEWS}}/g, previews);
fs.writeFileSync(path.join(REPO, "README.md"), fill(fa, faNum, SIZE_FA) + "## English" + fill(en, String, SIZE_EN));
console.log("README.md written");
