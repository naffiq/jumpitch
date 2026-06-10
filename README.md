# Jumpitch

A web-based 3D vaporwave rhythm game you control **with your voice**. A neon sphere auto-runs through a synthwave world; you sing the song's lead melody into your mic, and your pitch sets the sphere's height. The melody's notes are floating platforms (further along = later in the song, higher up = higher pitch). The backing track plays with the lead muted — land on platforms in time and those notes actually sound, so a clean run rebuilds the whole song. Ceiling spikes punish singing too sharp.

The run is recorded to a downloadable `.webm` (gameplay + optional webcam bubble + the audio you performed).

## Run it

```bash
npm install
npm run dev      # open the printed http://localhost:xxxx in Chrome/Edge/Firefox
```

Use **headphones** — open speakers bleed the backing track into the mic and hurt pitch detection (and the optional voice recording).

`npm run build` produces a static `dist/` you can host anywhere over HTTPS (mic/webcam require a secure context; `localhost` counts).

## How to play

1. Pick **Neon Tide** (built-in) or upload a `.mid` file.
2. Optionally enable the webcam bubble and/or recording your raw voice.
3. **Enable Microphone**, then hum a note until the calibration readout shows a stable pitch (it also measures your room noise).
4. **Start Run.** Sing higher to rise, lower to fall, stop to drop. Keep the orange dot inside the green band on the right-hand pitch meter to hit notes. Avoid the magenta ceiling spikes.
5. At the end: see your grade/accuracy, replay the recording, and download the `.webm`.

Pitch is **octave-folded**, so any vocal range (bass to soprano) plays the same melody.

## How it works

- **Pitch** — `pitchy` (McLeod Pitch Method) on a WebAudio `AnalyserNode`, median-filtered with voiced/unvoiced hysteresis and octave folding (`src/pitch/`).
- **Audio** — Tone.js. The `Transport` is the single game clock; backing parts are scheduled on it, while the lead synth fires only on note hits (`src/audio/`). The master bus and an opt-in mic channel feed a `MediaStreamAudioDestinationNode` for recording; the mic never reaches the speakers (no feedback).
- **Game** — note time → world Z, MIDI pitch → world Y; sphere follows pitch when voiced and falls under gravity when silent. Hits are judged musically (time window + ±1.5 semitone tolerance + coverage), not by physics collision (`src/game/`).
- **Render** — Three.js with a gradient-sky shader, striped retro sun, scrolling neon-grid floor, instanced platforms/spikes, and an `UnrealBloomPass` + RGB-shift glitch chain (`src/render/`).
- **Recording** — each frame the WebGL canvas is copied to a 2D canvas (same task, or frames record black) with the webcam composited as a circular PiP, then `MediaRecorder` muxes it with the audio mix (`src/recording/`).

All tunables live in `src/config.ts`. The `Song`/`NoteEvent` contract in `src/types.ts` is shared by the built-in track and the MIDI loader, so everything downstream is source-agnostic.
