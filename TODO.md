# TODO

## audio tune

- [x] Removed synthetic pentatonic chime generator (`chimeFallback.js`) so buttons never emit random oscillator noise
- [x] Default to OS offline speech (`window.speechSynthesis`) and keep current OS/recorded audio active while downloading in background
- [x] Added manual background loading & persistent IndexedDB caching (`voicePack` store) of a pre-generated neural Human Voice Pack (`public/voice-pack/`, 20 words, ~113 KB)
- [x] Added Loading Status Subsystem (`loadingStatus.js` + accessible `<progress>` bar + `"Ready to switch"` notification pill) and gated switching so the Human Voice Pack can only be selected once 100% cached

## first-press speech delay (Chromebook / iPad)

Reported: about 20 s of silence before the first spoken word after the device has been idle, then instant. Cause is inferred from the code, not measured on a device: the OS speech engine cold-starts after idle, and every press during the warm-up cancelled and re-queued the waiting utterance.

- [x] Never `cancel()` an utterance the engine has not started; keep only the latest press and speak it once the engine responds (`ttsVoice.js`, `ttsWarmup.js`, 30 s stall fallback)
- [x] Prime the engine with a volume-0 utterance on "Tap to Activate Soundboard", and every 60 s while Pet Mode is visible on the OS voice
- [x] Record start latency and speech error codes; show them in Voice Tune -> Speech diagnostics with a "Copy report" button (`speechDiagnostics.js`)
- [x] Replay the first touch on `pointerup` when the page had no user activation at `pointerdown`; activation banner binds to `click`
- [x] Hint beside the Human Voice Pack download recommending it on tablets and Chromebooks
- [ ] Confirm on a real Chromebook and iPad after a long idle, using the Speech diagnostics report
- [ ] Tune or remove the 60 s keep-warm ping based on that report (iPadOS may ignore speech outside a gesture)
