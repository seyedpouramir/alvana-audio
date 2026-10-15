# Credits & licences

Every file in this library comes from a source that allows sharing it again. The library only trimmed, levelled and re-encoded the files (loudness normalisation; music re-encoded to MP3) and gave them new names.

## Sound effects (`sfx/`)
| source | author | licence | used in |
|---|---|---|---|
| [Casino Audio](https://kenney.nl/assets/casino-audio), [Digital Audio](https://kenney.nl/assets/digital-audio), [Impact Sounds](https://kenney.nl/assets/impact-sounds), [Interface Sounds](https://kenney.nl/assets/interface-sounds), [Music Jingles](https://kenney.nl/assets/music-jingles), [RPG Audio](https://kenney.nl/assets/rpg-audio), [Sci-fi Sounds](https://kenney.nl/assets/sci-fi-sounds), [UI Audio](https://kenney.nl/assets/ui-audio) | Kenney ([kenney.nl](https://kenney.nl)) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) | casino, game, scifi, impact, footsteps, ui, notification, glitch, jingle, paper, door, money, mechanical, foley, data, explosion, water |
| [100 CC0 SFX](https://opengameart.org/content/100-cc0-sfx), [100 CC0 SFX #2](https://opengameart.org/content/100-cc0-sfx-2), [75 CC0 breaking / falling / hit SFX](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx), [25 CC0 bang / firework SFX](https://opengameart.org/content/25-cc0-bang-firework-sfx), [40 CC0 water / splash / slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx), [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) | rubberduck (OpenGameArt) | CC0 1.0 | foley, door, impact, break, explosion, water, ambience, creature, body, mechanical, misc, whoosh, pop, paper |
| [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack) | artisticdude (OpenGameArt) | CC0 1.0 | whoosh/swish-* |
| [Interface Beeps](https://opengameart.org/content/interface-beeps) | bart (OpenGameArt) | CC0 1.0 | ui/beep-* |
| [Keyboard Soundpack #1](https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes) | unicaegames (OpenGameArt) | CC0 1.0 | keyboard/key-* |
| Synthesized effects (whooshes, risers, impacts, shutters, gears, data, UI, notifications, beds…) and the `classic-*` set | made for this library (Alvana) — code in `tools/build/synth.mjs` | CC0 1.0 | all categories |

## Music (`music/`)
| source | author | licence | moods |
|---|---|---|---|
| 26 collections on OpenGameArt (Happy Lo-Fi, Lo-Fi And Chill, Chill Beats, Sad Lo-Fi, Chillout / Relaxing Instrumentals, Title Screens, Happy Pop Electronic, Funk, Gamer Beats, Retro Wave, Sci-Fi, Caves, Quiet Village, Haunted Mansion, Horror Beats, Game Over, Action / Chill / Happy Chiptunes, Game Boi) — [author page](https://opengameart.org/users/holizna) | HoliznaCC0 | CC0 1.0 | lofi, sad, chill, calm, intro, upbeat, funk, hiphop, synthwave, scifi, ambient, horror, dark, chiptune |
| "Happy Beats Business Moves" vol. 1, 9, 10, 11, 12 | Sascha Ende — [ende.app](https://ende.app) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — **credit required** | corporate |

### Credit line for the CC BY tracks (put it in your video description)
> Music: "Happy Beats Business Moves Vol. N" by Sascha Ende (https://ende.app), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Loudness-normalised by Alvana Audio.

`node get.mjs credits` writes these lines for exactly the tracks you used.

## Not included on purpose
Sound packs that are sold or given away with a "do not redistribute" licence (for example packs from Gumroad stores, Motion Array, Envato, Pixabay, and AI-generated music from services whose terms forbid sharing it as a library) are **not** in this repository. Use your own copies privately with `tools/index-local.mjs`.

Thank you Kenney, HoliznaCC0, rubberduck, artisticdude, bart, unicaegames and Sascha Ende for sharing your work so generously.
