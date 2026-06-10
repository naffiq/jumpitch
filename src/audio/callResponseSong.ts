// "Echo School" — a call-and-response teaching track in C major, 90 BPM.
// The synth sings a 2-bar phrase (the "call", demo notes that play
// automatically); two bars later the player sings the SAME phrase back (the
// "response", muted platforms). Backing repeats so the player echoes over
// identical accompaniment. Phrases use the C-major pentatonic so they're easy
// to pitch.

import { computeRegister, type NoteEvent, type Song } from '../types';

const BPM = 90;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const INTRO_BARS = 2;
const BLOCK_BARS = 4; // 2-bar call + 2-bar response
const OUTRO_BARS = 2;

// Bass roots per 4-bar block (C – Am – F – G feel).
const BLOCK_ROOTS = [36, 33, 29, 31]; // C2, A1, F1, G1

// Each phrase is a list of [beatOffset, midi, durationBeats] across 2 bars.
type Cell = [number, number, number];
const D4 = 62, E4 = 64, G4 = 67, A4 = 69, C5 = 72;

const PHRASES: Cell[][] = [
  // P1 — gentle steps
  [[0, E4, 1], [1, G4, 1], [2, A4, 1], [3, G4, 1], [4, E4, 2], [6, D4, 2]],
  // P2 — reach up to the octave
  [[0, G4, 1], [1, A4, 1], [2, C5, 1], [3, A4, 1], [4, G4, 2], [6, E4, 2]],
  // P3 — descending
  [[0, C5, 1], [1, A4, 1], [2, G4, 1], [3, E4, 1], [4, D4, 2], [6, E4, 2]],
  // P4 — climb to the top
  [[0, E4, 1], [1, G4, 1], [2, A4, 1], [3, C5, 1], [4, A4, 2], [6, G4, 2]],
];

function note(bar: number, beat: number, midi: number, durBeats: number, demo: boolean, velocity = 0.9): NoteEvent {
  return {
    time: bar * BAR + beat * BEAT,
    midi,
    duration: durBeats * BEAT * 0.92,
    velocity,
    demo,
  };
}

function buildLead(): NoteEvent[] {
  const out: NoteEvent[] = [];
  PHRASES.forEach((phrase, p) => {
    const callBar = INTRO_BARS + p * BLOCK_BARS; // 2-bar call
    const respBar = callBar + 2; // 2-bar response (same phrase)
    for (const [beat, midi, dur] of phrase) {
      out.push(note(callBar, beat, midi, dur, true, 0.95)); // teacher demonstrates
      out.push(note(respBar, beat, midi, dur, false)); // player echoes
    }
  });
  return out.sort((a, b) => a.time - b.time);
}

function buildDrums(totalBars: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < totalBars; bar++) {
    const quiet = bar < 1 || bar >= totalBars - 1;
    for (let beat = 0; beat < 4; beat++) {
      out.push(note(bar, beat, 36, 0.25, false, 0.95));
      if (!quiet && (beat === 1 || beat === 3)) out.push(note(bar, beat, 38, 0.25, false, 0.85));
      out.push(note(bar, beat + 0.5, 42, 0.125, false, 0.4));
    }
  }
  return out;
}

function buildBass(totalBars: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = INTRO_BARS - 1; bar < totalBars - OUTRO_BARS + 1; bar++) {
    const block = Math.max(0, Math.floor((bar - INTRO_BARS) / BLOCK_BARS));
    const root = BLOCK_ROOTS[block % BLOCK_ROOTS.length];
    for (let eighth = 0; eighth < 8; eighth++) {
      const midi = eighth % 4 === 2 ? root + 12 : root;
      out.push(note(bar, eighth * 0.5, midi, 0.45, false, 0.8));
    }
  }
  return out;
}

function buildPads(totalBars: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < totalBars; bar++) {
    const block = Math.max(0, Math.floor((bar - INTRO_BARS) / BLOCK_BARS));
    const root = BLOCK_ROOTS[block % BLOCK_ROOTS.length] % 12; // pitch class
    const chord = [root + 60, root + 64, root + 67]; // major triad up high
    for (const midi of chord) out.push(note(bar, 0, midi, 3.9, false, 0.55));
  }
  return out;
}

export function createCallResponseSong(): Song {
  const totalBars = INTRO_BARS + PHRASES.length * BLOCK_BARS + OUTRO_BARS;
  const lead = buildLead();
  return {
    title: 'Echo School',
    bpm: BPM,
    duration: totalBars * BAR,
    lead,
    backing: [
      { name: 'Drums', instrument: 'drums', notes: buildDrums(totalBars) },
      { name: 'Bass', instrument: 'bass', notes: buildBass(totalBars) },
      { name: 'Pads', instrument: 'pad', notes: buildPads(totalBars) },
    ],
    ...computeRegister(lead),
  };
}
