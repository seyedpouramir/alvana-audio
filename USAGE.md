# Alvana Audio — how to use it in a video

Written for Claude (and for people who edit by hand). Everything here is free to use in commercial videos: CC0 except the five `music/corporate` tracks (CC BY 4.0, credit required).

## 1. Quick start
```bash
curl -fsSLO https://raw.githubusercontent.com/seyedpouramir/alvana-audio/main/tools/get.mjs
node get.mjs list                                   # categories and moods with counts
node get.mjs search whoosh soft --max 5             # Persian works too: node get.mjs search ووش
node get.mjs get sfx/whoosh/soft-short music/lofi/blue-skies   # → public/audio/…
node get.mjs credits                                # → public/audio/CREDITS-audio.md
```
- Ids are file paths without the extension: `sfx/<category>/<name>`, `music/<mood>/<name>`.
- `get` saves under `public/audio/` by default (`--to <dir>` to change). For Remotion, use `staticFile("audio/sfx/whoosh/soft-short.wav")`.
- Do not read `index.json` (≈320 KB) into the conversation. Use `search` / `list` / `info`, or one group file: `index/sfx-<category>.json`, `index/music-<mood>.json`.
- Search filters: `--type sfx|music --cat <c> --mood <m> --dur 0.2-1 --bpm 90-120 --intensity low|mid|high --start instant|builds --tone warm|balanced|bright --max 15`.
- `node get.mjs info music/lofi/blue-skies` shows bpm, bars, drops, breaks, intro end and outro start.

## 2. What is inside
- `sfx/` — 48 kHz WAV. One-shots are trimmed so the sound starts at once and levelled to the same loudness: **active RMS −20 dBFS, peak ≤ −1 dBFS**. Loops (`bed: true`, mostly `ambience`) are levelled to RMS −26 dBFS and loop without a seam.
- Every effect has **`peak`**: the second at which it is loudest inside the file. To make a hit land on a frame, start the file `peak` seconds earlier.
- `music/` — MP3 (VBR ~190 kbps), all normalised to **−16 LUFS**, true peak ≤ −1 dBTP. Every track has a cue file next to it (`.json`): `bpm`, `beats`, `bars` (downbeats), `kicks`, `snares`, `energy` (0–100 every 0.5 s), `phrases`, `drops`, `breaks`, `intro_end`, `outro_start`. All times are measured on the MP3 itself.
- `intensity` (low / mid / high) is relative to this library. `start: instant` means melody and beat from the first second; `builds` means it fades or grows in.
- `previews/` — one MP3 per category / mood with every item in catalogue order. `CATALOG.md` lists them all.

## 3. Choosing music
| video | moods to try | notes |
|---|---|---|
| Reel, teaser, promo, intro (music only) | `upbeat`, `synthwave`, `funk`, `hiphop`, `chiptune` | Pick `--start instant`. "A song" means melody and beat from the very first second; a ticking or droning intro does not count. Put the strongest visual on a drop. |
| Explainer / tutorial under narration | `corporate`, `lofi`, `chill`, `calm` | `--intensity low` or `mid`. Steady, no busy lead melody under speech. |
| Documentary / science / space | `ambient`, `scifi`, `calm`, `intro` | Lift the music a little in pauses. Change tracks at chapter turns with a 1–2 s cross-fade. |
| Story / dialogue / emotional | `calm`, `sad`, `intro` | Quiet under the voices; let the last line breathe before the music swells. |
| Horror / mystery / true crime | `horror`, `dark`, `ambient` | Combine with `riser`, `impact`, `body/heartbeat`. |
| Tech / AI / product | `synthwave`, `scifi`, `upbeat`, `corporate` | |
| Vlog / lifestyle | `lofi` (happy ones), `chill`, `funk` | |
| Gaming | `chiptune`, `hiphop` | |

Rules that came from real projects:
- **Do not cut or splice the inside of a track.** It sounds unnatural. Trim only the start, end on a phrase boundary (`phrases` / `bars`) with a 2–3 s fade, or pick a track whose length fits.
- **Drop on the key word:** start the music at `drop − wordTime` (music offset), so the drop lands on the word or the reveal. Main cuts on `bars` (±0.15 s), smaller entrances on `beats` (±0.1 s).
- Beat times from the full mix are approximate (±30 ms). For a frame-exact hit, nudge the cut +0.03 s.
- Several tracks in one long video: cross-fade 1–2 s on a bar; keep them in the same mood family.

## 4. Placing effects
- **One effect per visible event**, and its **peak on the event's frame**: start = event − `peak`.
- **Never over the words.** Effects stay under the voice: per-effect volume 0.3–0.5, and duck the whole effects bus under the narration (`tools/mix.mjs` does it).
- **Repeating the same sound is irritating:** the same file at most 4–5 times per video, quietly. There are many variants: use them.
- Transitions: a whoosh peaks on the cut (starts ~0.1–0.3 s before), a riser ends exactly on the cut / drop, an impact sits on the reveal, a reverse swell (`sfx/transition/swell-*`) stops on the cut.
- Repeated UI sounds (clicks, typing, pops): prefer `--tone warm` or `balanced`. Keep `bright` ones for tiny accents.
- Typing: one `sfx/keyboard/key-*` per character, rotate through several ids, slightly random volume (0.2–0.35).
- Ambience: a bed (`--cat ambience`) under a whole scene at low volume gives "place" without being noticed.

## 5. Levels (the balance approved on real finished videos)
| stem | LUFS |
|---|---|
| narration / dialogue | −21 to −22 |
| music under a voice | −31 to −33 (energetic videos up to −28) → gain ≈ 0.15–0.2 on these −16 LUFS files |
| music alone (no voice) | gain 1.0, then normalise the final mix |
| effects (whole stem) | −36 to −39 |
| **final file** | **−14 LUFS**, true peak −1.5 dB (YouTube / Instagram) |
- No dynamic processing on TTS voices (no echo, compressor, dynamic loudnorm, time-stretch): a fixed gain per speaker only.
- Normalise the final mix with two-pass `loudnorm … linear=true` (`tools/mix.mjs` does this).

## 6. Remotion
```tsx
import { Html5Audio, Sequence, staticFile, useVideoConfig } from "remotion";
// effect: peak lands on frame `hitFrame`
const { fps } = useVideoConfig();
<Sequence from={Math.round(hitFrame - 0.201 * fps)} layout="none">
  <Html5Audio src={staticFile("audio/sfx/whoosh/soft-short.wav")} volume={0.4} />
</Sequence>
// music bed under narration, faded in and out
<Html5Audio src={staticFile("audio/music/lofi/blue-skies.mp3")}
  volume={(f) => 0.18 * Math.min(1, f / (0.5 * fps)) * Math.min(1, (durationInFrames - f) / (3 * fps))} />
```
- Use `Html5Audio` from `remotion` inside `<Sequence layout="none">` (`@remotion/media` can time out on long WAV files).
- Do not change files in `public/` while a render is running.
- Long or effect-heavy videos: render silent, mix with `tools/mix.mjs`, then put the mix on the video. Do not use `-shortest` when muxing (it drops the last frames).

## 7. Mixing with `tools/mix.mjs` (ffmpeg)
```bash
curl -fsSLO https://raw.githubusercontent.com/seyedpouramir/alvana-audio/main/tools/mix.mjs
node mix.mjs mix.json --video out/silent.mp4 --final out/final.mp4
node mix.mjs mix.json --stems        # check: voice ≈ −21, music ≈ −31, effects ≈ −38 LUFS
```
```json
{ "length": 32, "voice": "public/vo.wav",
  "music": [{ "id": "music/lofi/blue-skies", "at": 0, "from": 12.4, "to": 32, "fadeIn": 0.5, "fadeOut": 3, "gain": 0.18 }],
  "sfx":   [{ "id": "sfx/whoosh/soft-short", "at": 2.4, "vol": 0.4 }, { "id": "sfx/impact/cinematic-heavy", "at": 8.0, "vol": 0.45 }],
  "beds":  [{ "id": "sfx/ambience/wind", "from": 0, "to": 32, "vol": 0.3 }] }
```
`at` is when the effect's peak should land; ids are resolved from the files `get.mjs` downloaded (or give `"file"` and `"peak"`). Music `from` = offset inside the track.

## 8. Credits and licences
- CC0 (almost everything): no credit needed — a thank-you is nice ("Sound: Kenney, HoliznaCC0, rubberduck, Alvana Audio").
- **CC BY 4.0 (`music/corporate/*`, ende.app): credit is required.** `node get.mjs credits` writes the exact lines; paste them in the video description.
- YouTube Content ID: CC0 music can still get a wrong claim from someone else. Upload unlisted first; if claimed, dispute it with the licence link (https://creativecommons.org/publicdomain/zero/1.0/). ende.app tracks are not registered in Content ID.
- Never re-upload sound packs whose licence does not allow it (most bought or "free" packs on Gumroad, Motion Array, Pixabay…). Use them privately: see §9.

## 9. Your own private packs
```bash
curl -fsSLO https://raw.githubusercontent.com/seyedpouramir/alvana-audio/main/tools/index-local.mjs
node index-local.mjs "D:/My Sound Packs" --level      # → public/audio/.alvana/local-index.json + levelled copies
node get.mjs search whoosh                           # your files appear marked LOCAL
```
Keep `public/audio/local/` out of any public repository.

## 10. Network
- `get.mjs` downloads from `raw.githubusercontent.com`; if that host is blocked it falls back to a sparse `git` checkout through `github.com` (needs git).
- Behind a proxy: set `HTTPS_PROXY=http://host:port` (curl uses it).
- Claude Code on the web (cloud): GitHub is on the default allow-list, so the commands above work as they are.
