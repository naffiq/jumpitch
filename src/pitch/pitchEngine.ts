// Main-thread facade over the audio-thread worklet. Each worklet message is
// pushed straight through the smoother + octave folder, so the median filter
// and voiced hysteresis run at the worklet's cadence (~5 ms) rather than the
// render framerate. The game just reads the latest state via sample().

import { CONFIG } from '../config';
import type { MicInput } from './micInput';
import { PitchSmoother } from './pitchSmoother';
import { OctaveFolder } from './octaveFolding';
import { freqToMidiFloat, midiToFreq, type RawPitchFrame, type WorkletPitchMessage } from './pitchTypes';

export interface PitchSample {
  voiced: boolean;
  foldedMidi: number | null;
  rawMidi: number | null;
  freq: number | null;
  clarity: number;
  rms: number;
}

const EMPTY_RAW: RawPitchFrame = { freq: null, midiFloat: null, clarity: 0, rms: 0 };
const EMPTY_SAMPLE: PitchSample = {
  voiced: false,
  foldedMidi: null,
  rawMidi: null,
  freq: null,
  clarity: 0,
  rms: 0,
};

export class PitchEngine {
  private smoother = new PitchSmoother();
  private folder = new OctaveFolder();
  private node: AudioWorkletNode;
  private lastRaw: RawPitchFrame = EMPTY_RAW;
  private current: PitchSample = EMPTY_SAMPLE;

  constructor(mic: MicInput) {
    this.node = mic.workletNode;
    this.node.port.onmessage = (e: MessageEvent<WorkletPitchMessage>) => this.onFrame(e.data);
  }

  private onFrame(msg: WorkletPitchMessage): void {
    const valid =
      msg.freq !== null && msg.freq >= CONFIG.minFreq && msg.freq <= CONFIG.maxFreq;
    const raw: RawPitchFrame = {
      freq: valid ? msg.freq : null,
      midiFloat: valid ? freqToMidiFloat(msg.freq as number) : null,
      clarity: valid ? msg.clarity : 0,
      rms: msg.rms,
    };
    this.lastRaw = raw;

    const smooth = this.smoother.push(raw);
    let folded: number | null = null;
    if (smooth.voiced && smooth.midi !== null) {
      folded = this.folder.fold(smooth.midi, smooth.voicedOnset);
    }
    this.current = {
      voiced: smooth.voiced,
      foldedMidi: folded,
      rawMidi: smooth.midi,
      freq: raw.freq,
      clarity: raw.clarity,
      rms: raw.rms,
    };
  }

  setRegister(center: number): void {
    this.folder.setRegister(center);
  }

  /** Auto-set the voiced gate from measured ambient noise (calibration). */
  setAmbientRms(ambient: number): void {
    this.smoother.rmsGate = Math.max(0.008, ambient * 3);
  }

  /**
   * Narrow the worklet's analysis window to the singer's range. A higher
   * minimum frequency means a shorter window and lower latency. Pass the
   * lowest note you expect them to actually produce (in MIDI).
   */
  setExpectedLowMidi(midi: number): void {
    const hz = Math.max(60, Math.min(250, midiToFreq(midi)));
    this.node.port.postMessage({ minFreq: hz });
  }

  /** Latest unsmoothed frame (for the calibration readout). */
  sampleRaw(): RawPitchFrame {
    return this.lastRaw;
  }

  /** Latest smoothed/folded state (the worklet keeps this fresh between frames). */
  sample(): PitchSample {
    return this.current;
  }

  reset(): void {
    this.smoother.reset();
    this.folder.reset();
    this.current = EMPTY_SAMPLE;
  }
}
