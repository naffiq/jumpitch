// The melody voice. It plays the target note throughout the note's span as a
// reference for the player; a controllable low-pass + gain stage ("match")
// keeps it muffled and quiet while the player is off pitch and opens it up to
// bright and full when they're matching. Signal chain:
//   synth → matchFilter (lowpass) → matchGain → reverb → delay → destination

import * as Tone from 'tone';
import { CONFIG } from '../config';

export class LeadSynth {
  private synth: Tone.MonoSynth;
  private matchFilter: Tone.Filter;
  private matchGain: Tone.Gain;
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private out: Tone.Gain;
  private activeMidi: number | null = null;

  constructor() {
    this.out = new Tone.Gain(1).toDestination();
    this.delay = new Tone.FeedbackDelay('8n.', 0.3).connect(this.out);
    this.delay.wet.value = 0.25;
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(this.delay);
    this.matchGain = new Tone.Gain(CONFIG.lead.refGain).connect(this.reverb);
    this.matchFilter = new Tone.Filter(CONFIG.lead.refCutoff, 'lowpass').connect(this.matchGain);
    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 1 },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.25 },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.7,
        release: 0.3,
        baseFrequency: 1200,
        octaves: 3,
      },
      volume: -6,
    }).connect(this.matchFilter);
  }

  attack(midi: number): void {
    const freq = Tone.Frequency(midi, 'midi').toFrequency();
    if (this.activeMidi !== null) {
      this.synth.setNote(freq);
    } else {
      this.synth.triggerAttack(freq);
    }
    this.activeMidi = midi;
  }

  release(): void {
    if (this.activeMidi !== null) {
      this.synth.triggerRelease();
      this.activeMidi = null;
    }
  }

  /** Hard stop any ringing note (reference or scheduled demo) — used on pause. */
  releaseAll(): void {
    this.synth.triggerRelease();
    this.activeMidi = null;
  }

  /**
   * Pitch-match amount, 0 = off (muffled, quiet reference) … 1 = on (bright,
   * full). `time` schedules the glide for sample-accurate demo playback.
   */
  setMatch(q: number, time?: number): void {
    q = Math.max(0, Math.min(1, q));
    const { refCutoff, openCutoff, refGain, onGain, matchRamp } = CONFIG.lead;
    const cutoff = refCutoff * Math.pow(openCutoff / refCutoff, q); // exponential in Hz
    const gain = refGain + (onGain - refGain) * q;
    this.matchFilter.frequency.rampTo(cutoff, matchRamp, time);
    this.matchGain.gain.rampTo(gain, matchRamp, time);
  }

  /** Silence the reference voice entirely (e.g. when singing to a real backing video). */
  mute(): void {
    this.out.gain.value = 0;
  }

  get playingMidi(): number | null {
    return this.activeMidi;
  }

  /** Sample-accurate scheduled note for the call-and-response demo (always full/bright). */
  playAt(midi: number, duration: number, time: number): void {
    this.setMatch(1, time);
    this.synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), duration, time);
  }

  dispose(): void {
    this.release();
    [this.synth, this.matchFilter, this.matchGain, this.reverb, this.delay, this.out].forEach((n) =>
      n.dispose(),
    );
  }
}
