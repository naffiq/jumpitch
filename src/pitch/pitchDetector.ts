import { PitchDetector as Mpm } from 'pitchy';
import { CONFIG } from '../config';

export interface RawPitchFrame {
  freq: number | null; // Hz, null if out of plausible range
  midiFloat: number | null;
  clarity: number; // 0..1
  rms: number;
}

export function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Wraps pitchy's McLeod Pitch Method over an AnalyserNode time-domain buffer. */
export class PitchAnalyzer {
  private detector: Mpm<Float32Array>;
  private buffer: Float32Array<ArrayBuffer>;

  constructor(
    private analyser: AnalyserNode,
    private sampleRate: number,
  ) {
    this.detector = Mpm.forFloat32Array(analyser.fftSize);
    this.buffer = new Float32Array(analyser.fftSize);
  }

  sample(): RawPitchFrame {
    this.analyser.getFloatTimeDomainData(this.buffer);
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    const rms = Math.sqrt(sum / this.buffer.length);
    const [freq, clarity] = this.detector.findPitch(this.buffer, this.sampleRate);
    const valid = freq >= CONFIG.minFreq && freq <= CONFIG.maxFreq && Number.isFinite(freq);
    return {
      freq: valid ? freq : null,
      midiFloat: valid ? freqToMidiFloat(freq) : null,
      clarity: valid ? clarity : 0,
      rms,
    };
  }
}
