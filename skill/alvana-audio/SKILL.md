---
name: alvana-audio
description: Free music (157 tracks, CC0 / CC BY) and sound effects (1,200+, CC0) for videos from the public Alvana Audio library on GitHub — search, download only the needed files, place effects on the visible events and music on the beats, and mix at the approved levels. Use whenever a video needs music, sound effects, ambience, a beat grid or a final audio mix.
---

# Alvana Audio

Library: https://github.com/seyedpouramir/alvana-audio · full guide: https://raw.githubusercontent.com/seyedpouramir/alvana-audio/main/USAGE.md (read §3–§5 before choosing).

## Commands
```bash
curl -fsSLO https://raw.githubusercontent.com/seyedpouramir/alvana-audio/main/tools/get.mjs   # once per project
node get.mjs list
node get.mjs search <words…> [--type sfx|music --cat c --mood m --intensity low|mid|high --start instant --dur 0.2-1 --max 10]
node get.mjs get <id…>            # → public/audio/<id>.wav|.mp3 (+ .json cue file for music)
node get.mjs info <music id>      # bpm, bars, drops, breaks
node get.mjs credits              # → public/audio/CREDITS-audio.md (paste CC BY lines in the description)
```
Never read `index.json` into the conversation — search instead.

## Rules
1. Effects: one per visible event; start the file `peak` seconds before the event so the peak lands on its frame; the same file at most 4–5 times; never louder than or over the narration (volume 0.3–0.5, effects bus ducked by the voice).
2. Music: never splice the inside of a track; end on a phrase with a 2–3 s fade. Music-only videos need `--start instant` (melody and beat from second one). Put the key word / reveal on a drop: music offset = drop − word time.
3. Levels: voice −21 to −22 LUFS · music under voice −31 to −33 (gain ≈ 0.18 on these −16 LUFS files) · effects stem −36 to −39 · final −14 LUFS, true peak −1.5. No dynamic processing on TTS voices.
4. Mix long or effect-heavy videos with `tools/mix.mjs` (download it like get.mjs) — it ducks music and effects under the voice and normalises to −14 LUFS.
5. Remotion: `Html5Audio` from `remotion` inside `<Sequence layout="none">`; `staticFile("audio/…")`.
6. Licences: CC0 needs no credit; `music/corporate/*` is CC BY 4.0 — credit required. Never upload the user's private packs anywhere (index them with `tools/index-local.mjs`).
