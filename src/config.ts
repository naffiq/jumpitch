// Every gameplay/audio/visual tunable lives here.

export const CONFIG = {
  // World mapping
  scrollSpeed: 14, // world units per second along -Z
  semitoneHeight: 0.45, // world units per semitone

  // Player physics
  smoothTau: 0.06, // seconds; exp smoothing toward sung pitch
  gravity: 25, // units/s^2 when silent
  sphereRadius: 0.45,
  maxDt: 0.05,
  ceilingMarginSemitones: 6, // how far above the highest note the sphere may rise

  // Pitch detection
  fftSize: 2048,
  clarityThreshold: 0.93,
  rmsThreshold: 0.015,
  minFreq: 55,
  maxFreq: 1200,
  voicedFramesIn: 3,
  voicedFramesOut: 5,
  medianWindow: 5,

  // Judging
  inputLatencyComp: 0.09, // seconds subtracted from transport time when judging
  hitWindowPad: 0.12, // seconds before/after a note that still count
  hitToleranceSemitones: 1.5,
  offFramesRelease: 5, // consecutive off frames before lead synth releases
  shortNoteDuration: 0.2, // notes shorter than this hit on any on-frame
  hitCoverage: 0.5,
  perfectCoverage: 0.9,
  perfectAvgError: 0.5, // semitones

  // Spikes
  spikeMinNoteDuration: 0.75,
  spikeOffsetSemitones: 3, // semitones above the note; reachable by over-singing
  spikeClearanceWindow: 2, // seconds; nearby legit notes block spike placement
  spikeCooldown: 1, // invulnerability seconds after a hit
  spikePenalty: 200,

  // Scoring / health
  maxHealth: 5,
  scorePerfect: 300,
  scoreGood: 100,

  // Recording
  recordWidth: 1280,
  recordHeight: 720,
  recordFps: 60,
  videoBitsPerSecond: 6_000_000,

  // Camera (side-on / profile view)
  cameraFov: 52,
  cam: {
    sideOffset: 13, // camera distance out along +X from the x=0 play plane
    ahead: 5.5, // shifts the sphere toward the left third (more lookahead on the right)
    tilt: 4, // camera sits this far above its look point → gentle downward tilt
    followFactor: 0.25, // how much the camera's height tracks the sphere
    followClampLo: -3,
    followClampHi: 5,
    followTau: 0.25,
  },

  colors: {
    sky0: 0x12042e,
    sky1: 0x4a0f6e,
    sky2: 0xff3caa,
    horizon: 0xff8c42,
    fog: 0x2b0a4d,
    gridA: 0x00f0ff,
    gridB: 0xff2bd6,
    platform: 0x00e5ff,
    platformHit: 0xb7ff00,
    demoPlatform: 0xff5cf0, // teacher's example notes
    demoPlatformHit: 0xffd86b,
    spike: 0xff2bd6,
    sphere: 0xff8c42,
    sun0: 0xffd319,
    sun1: 0xff2975,
  },
} as const;
