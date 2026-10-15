# Alvana Audio — notes for Claude

This repository is a free music and sound-effect library for videos. Everything is CC0 except `music/corporate/*` (CC BY 4.0, credit required).

- Using it in a video project: follow `USAGE.md`. In another project, download only the files you need with `tools/get.mjs` (no clone). Inside this repository the files are already here: the ids are their paths without the extension.
- Do not read `index.json` whole (large). Use `node tools/get.mjs search …`, or one group file in `index/`.
- Effects: place the file `peak` seconds before the event. Music cue files (`music/**/*.json`) hold bpm, bars, drops and breaks.
- Rebuilding the library (maintainers): `tools/build/` — `synth.mjs` (own effects), `build.mjs` (level, trim, analyse; shards), `docs.mjs` (index + catalogue), `previews.mjs` (reels). Sources and licences: `tools/build/sources.mjs`, `CREDITS.md`.
- Only add audio whose licence allows redistribution (CC0, CC BY, public domain). Never add bought packs, Pixabay / Motion Array / Envato files, or AI-generated music whose terms forbid libraries.
