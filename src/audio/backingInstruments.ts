import * as Tone from 'tone';
import type { InstrumentId, NoteEvent } from '../types';

export interface BackingInstrument {
  trigger(note: NoteEvent, time: number): void;
  dispose(): void;
}

function makeDrums(): BackingInstrument {
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 7,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
    volume: -4,
  }).toDestination();
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -10,
  }).toDestination();
  const snareTone = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.001, decay: 0.1, sustain: 0 },
    volume: -16,
  }).toDestination();
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    volume: -18,
  });
  const hatFilter = new Tone.Filter(8000, 'highpass').toDestination();
  hat.connect(hatFilter);

  return {
    trigger(note, time) {
      const m = note.midi;
      if (m === 35 || m === 36) kick.triggerAttackRelease('C1', '8n', time, note.velocity ?? 1);
      else if (m === 38 || m === 40) {
        snare.triggerAttackRelease('16n', time, note.velocity ?? 0.9);
        snareTone.triggerAttackRelease('G3', '16n', time, 0.5);
      } else {
        hat.triggerAttackRelease('32n', time, note.velocity ?? 0.6);
      }
    },
    dispose() {
      [kick, snare, snareTone, hat, hatFilter].forEach((n) => n.dispose());
    },
  };
}

function makeBass(): BackingInstrument {
  const synth = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', Q: 2 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.1 },
    filterEnvelope: {
      attack: 0.005,
      decay: 0.15,
      sustain: 0.3,
      release: 0.1,
      baseFrequency: 80,
      octaves: 3,
    },
    volume: -8,
  }).toDestination();
  return {
    trigger(note, time) {
      synth.triggerAttackRelease(
        Tone.Frequency(note.midi, 'midi').toFrequency(),
        note.duration,
        time,
        note.velocity ?? 0.9,
      );
    },
    dispose() {
      synth.dispose();
    },
  };
}

function makePad(): BackingInstrument {
  const chorus = new Tone.Chorus(0.6, 3.5, 0.4).toDestination().start();
  const reverb = new Tone.Reverb({ decay: 4, wet: 0.45 }).connect(chorus);
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
    envelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.2 },
    volume: -18,
  }).connect(reverb);
  return {
    trigger(note, time) {
      synth.triggerAttackRelease(
        Tone.Frequency(note.midi, 'midi').toFrequency(),
        note.duration,
        time,
        note.velocity ?? 0.7,
      );
    },
    dispose() {
      [synth, reverb, chorus].forEach((n) => n.dispose());
    },
  };
}

function makePluck(): BackingInstrument {
  const delay = new Tone.FeedbackDelay('8n', 0.25).toDestination();
  delay.wet.value = 0.2;
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.15, sustain: 0.1, release: 0.2 },
    volume: -14,
  }).connect(delay);
  return {
    trigger(note, time) {
      synth.triggerAttackRelease(
        Tone.Frequency(note.midi, 'midi').toFrequency(),
        Math.min(note.duration, 0.5),
        time,
        note.velocity ?? 0.8,
      );
    },
    dispose() {
      [synth, delay].forEach((n) => n.dispose());
    },
  };
}

export function createBackingInstrument(id: InstrumentId): BackingInstrument {
  switch (id) {
    case 'drums':
      return makeDrums();
    case 'bass':
      return makeBass();
    case 'pad':
      return makePad();
    case 'pluck':
      return makePluck();
  }
}
