export interface RawPitchFrame {
  freq: number | null; // Hz, null if out of plausible range / unvoiced
  midiFloat: number | null;
  clarity: number; // 0..1
  rms: number;
}

/** Raw frame as posted by the audio-thread worklet. */
export interface WorkletPitchMessage {
  freq: number | null;
  clarity: number;
  rms: number;
}

export function freqToMidiFloat(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
