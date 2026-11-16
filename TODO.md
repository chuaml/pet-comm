# TODO

## audio tune

- [x] Identified and fixed all 4 button audio delay & dropped speech root causes:
  - [x] Strictly prioritize local offline OS voices (`localService: true`) over slow/flaky remote cloud streaming TTS voices
  - [x] Eliminate idle `speechSynthesis.cancel()` + `speak()` IPC race, resume `paused` state, and hold strong `activeUtterance` reference
  - [x] Remove first-press `unlockAudioEngine()` empty-utterance collision and `e.preventDefault()` gesture block on `.pet-pad` `pointerdown`, plus pre-warm `speechSynthesis.getVoices()` on app boot
  - [x] Add automatic Web Audio pentatonic chime fallback if OS TTS is unavailable or stalls `>250ms`

## button types

- [x] More color customization:
  - [x] Expanded pre-made color palette to 18 WCAG high-contrast swatches
  - [x] Added Custom Full RGB controls (`R/G/B` `0–255` sliders + color picker + `#HEX` input) for Button Background with auto high-contrast Text & Border plus optional Text/Icon RGB override
- [x] Smart non-repeating automatic coloring:
  - [x] Unique non-repeating colors across all 14 starter Button Type presets
  - [x] 2D neighbor-aware + least-used + perceptual-distance auto-coloring when creating buttons and via one-tap Parent Mode **Auto-Color** button (preserving Custom RGB buttons)
