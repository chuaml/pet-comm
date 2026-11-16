# TODO

## audio tune

- [x] Removed synthetic pentatonic chime generator (`chimeFallback.js`) so buttons never emit random oscillator noise
- [x] Default to OS offline speech (`window.speechSynthesis`) and keep current OS/recorded audio active while downloading in background
- [x] Added manual background loading & persistent IndexedDB caching (`voicePack` store) of a pre-generated neural Human Voice Pack (`public/voice-pack/`, 20 words, ~113 KB)
- [x] Added Loading Status Subsystem (`loadingStatus.js` + accessible `<progress>` bar + `"Ready to switch"` notification pill) and gated switching so the Human Voice Pack can only be selected once 100% cached
