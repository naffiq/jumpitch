// The muted melody voice. It is NOT scheduled on the Transport — it only
// sounds when hitDetection reports the player riding a platform, so a perfect
// run reconstructs the lead line in real time.

import * as Tone from 'tone';

export class LeadSynth {
  private synth: Tone.MonoSynth;
  private reverb: Tone.Reverb;
  private delay: Tone.FeedbackDelay;
  private activeMidi: number | null = null;

  constructor() {
    this.delay = new Tone.FeedbackDelay('8n.', 0.3).toDestination();
    this.delay.wet.value = 0.25;
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(this.delay);
    this.synth = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', Q: 1 },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.25 },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.6,
        release: 0.3,
        baseFrequency: 600,
        octaves: 2.5,
      },
      volume: -6,
    }).connect(this.reverb);
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

  /** Sample-accurate scheduled note for the call-and-response demo. */
  playAt(midi: number, duration: number, time: number): void {
    this.synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), duration, time);
  }

  get playingMidi(): number | null {
    return this.activeMidi;
  }

  dispose(): void {
    this.release();
    [this.synth, this.reverb, this.delay].forEach((n) => n.dispose());
  }
}
