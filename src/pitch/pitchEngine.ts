// Facade composing analyzer → smoother → octave folder into one per-frame sample.

import type { MicInput } from './micInput';
import { PitchAnalyzer, type RawPitchFrame } from './pitchDetector';
import { PitchSmoother } from './pitchSmoother';
import { OctaveFolder } from './octaveFolding';

export interface PitchSample {
  voiced: boolean;
  foldedMidi: number | null;
  rawMidi: number | null;
  freq: number | null;
  clarity: number;
  rms: number;
}

export class PitchEngine {
  private analyzer: PitchAnalyzer;
  private smoother = new PitchSmoother();
  private folder = new OctaveFolder();

  constructor(mic: MicInput, sampleRate: number) {
    this.analyzer = new PitchAnalyzer(mic.analyser, sampleRate);
  }

  setRegister(center: number): void {
    this.folder.setRegister(center);
  }

  /** Auto-set the voiced gate from measured ambient noise (calibration). */
  setAmbientRms(ambient: number): void {
    this.smoother.rmsGate = Math.max(0.008, ambient * 3);
  }

  sampleRaw(): RawPitchFrame {
    return this.analyzer.sample();
  }

  sample(): PitchSample {
    const raw = this.analyzer.sample();
    const smooth = this.smoother.push(raw);
    let folded: number | null = null;
    if (smooth.voiced && smooth.midi !== null) {
      folded = this.folder.fold(smooth.midi, smooth.voicedOnset);
    }
    return {
      voiced: smooth.voiced,
      foldedMidi: folded,
      rawMidi: smooth.midi,
      freq: raw.freq,
      clarity: raw.clarity,
      rms: raw.rms,
    };
  }

  reset(): void {
    this.smoother.reset();
    this.folder.reset();
  }
}
