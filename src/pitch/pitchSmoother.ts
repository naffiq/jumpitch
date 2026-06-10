import { CONFIG } from '../config';
import type { RawPitchFrame } from './pitchDetector';

export interface SmoothedPitch {
  voiced: boolean;
  midi: number | null; // median-filtered midi float, only when voiced
  voicedOnset: boolean; // true on the first voiced frame of a phrase
}

/**
 * Voiced/unvoiced hysteresis (3 frames in, 5 out) + median-of-5 filter.
 * The median kills MPM's octave-error spikes; hysteresis kills breath blips.
 */
export class PitchSmoother {
  private voiced = false;
  private inStreak = 0;
  private outStreak = 0;
  private ring: number[] = [];
  rmsGate: number = CONFIG.rmsThreshold;

  push(frame: RawPitchFrame): SmoothedPitch {
    const frameVoiced =
      frame.midiFloat !== null &&
      frame.clarity > CONFIG.clarityThreshold &&
      frame.rms > this.rmsGate;

    let onset = false;
    if (frameVoiced) {
      this.inStreak++;
      this.outStreak = 0;
      if (!this.voiced && this.inStreak >= CONFIG.voicedFramesIn) {
        this.voiced = true;
        onset = true;
        this.ring.length = 0;
      }
    } else {
      this.outStreak++;
      this.inStreak = 0;
      if (this.voiced && this.outStreak >= CONFIG.voicedFramesOut) {
        this.voiced = false;
        this.ring.length = 0;
      }
    }

    if (frame.midiFloat !== null && frameVoiced) {
      this.ring.push(frame.midiFloat);
      if (this.ring.length > CONFIG.medianWindow) this.ring.shift();
    }

    if (!this.voiced || this.ring.length === 0) {
      return { voiced: false, midi: null, voicedOnset: false };
    }
    const sorted = [...this.ring].sort((a, b) => a - b);
    return { voiced: true, midi: sorted[Math.floor(sorted.length / 2)], voicedOnset: onset };
  }

  reset(): void {
    this.voiced = false;
    this.inStreak = 0;
    this.outStreak = 0;
    this.ring.length = 0;
  }
}
