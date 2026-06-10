// "Neon Tide" — original synthwave track in A minor, 100 BPM, 24 bars.
// 4-bar intro (backing builds), 16-bar lead melody (the level), 4-bar outro.
// The lead array doubles as the platform layout.

import { computeRegister, type NoteEvent, type Song } from '../types';

const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const TOTAL_BARS = 24;
const MELODY_START_BAR = 4;

// midi helpers
const A2 = 45, F2 = 41, C2 = 36, G2 = 43;
const D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72;

type Chord = { root: number; pad: number[] };
const PROGRESSION: Chord[] = [
  { root: A2, pad: [57, 60, 64] }, // Am
  { root: F2, pad: [53, 57, 60] }, // F
  { root: C2, pad: [55, 60, 64] }, // C (inverted)
  { root: G2, pad: [55, 59, 62] }, // G
];

function note(bar: number, beat: number, midi: number, durBeats: number, velocity = 0.9): NoteEvent {
  return { time: bar * BAR + beat * BEAT, midi, duration: durBeats * BEAT * 0.95, velocity };
}

function buildDrums(): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    const quiet = bar < 2 || bar >= TOTAL_BARS - 1;
    for (let beat = 0; beat < 4; beat++) {
      out.push(note(bar, beat, 36, 0.25, 1)); // four-on-the-floor kick
      if (!quiet && (beat === 1 || beat === 3)) out.push(note(bar, beat, 38, 0.25, 0.9));
      out.push(note(bar, beat + 0.5, 42, 0.125, 0.5)); // offbeat hats
      if (bar >= 2 && bar < TOTAL_BARS - 1) out.push(note(bar, beat, 42, 0.125, 0.3));
    }
  }
  return out;
}

function buildBass(): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 1; bar < TOTAL_BARS; bar++) {
    const root = PROGRESSION[bar % 4].root;
    for (let eighth = 0; eighth < 8; eighth++) {
      const midi = eighth % 3 === 2 ? root + 12 : root; // octave pop every third eighth
      out.push(note(bar, eighth * 0.5, midi, 0.45, 0.85));
    }
  }
  return out;
}

function buildPads(): NoteEvent[] {
  const out: NoteEvent[] = [];
  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    for (const midi of PROGRESSION[bar % 4].pad) {
      out.push(note(bar, 0, midi, 3.9, 0.65));
    }
  }
  return out;
}

function buildLead(): NoteEvent[] {
  const s = MELODY_START_BAR;
  // Two 8-bar phrases over Am–F–C–G. Long notes (>= 2 beats) attract ceiling spikes.
  return [
    // Phrase A
    note(s + 0, 0, A4, 1.5), note(s + 0, 1.5, G4, 0.5), note(s + 0, 2, E4, 1), note(s + 0, 3, G4, 1),
    note(s + 1, 0, A4, 2), note(s + 1, 2, C5, 1), note(s + 1, 3, A4, 1),
    note(s + 2, 0, G4, 1.5), note(s + 2, 1.5, E4, 0.5), note(s + 2, 2, G4, 1), note(s + 2, 3, C5, 1),
    note(s + 3, 0, B4, 1), note(s + 3, 1, G4, 1), note(s + 3, 2, D4, 2),
    note(s + 4, 0, A4, 1.5), note(s + 4, 1.5, G4, 0.5), note(s + 4, 2, A4, 1), note(s + 4, 3, C5, 1),
    note(s + 5, 0, C5, 1.5), note(s + 5, 1.5, A4, 0.5), note(s + 5, 2, G4, 1), note(s + 5, 3, F4, 1),
    note(s + 6, 0, E4, 1.5), note(s + 6, 1.5, G4, 0.5), note(s + 6, 2, A4, 1), note(s + 6, 3, G4, 1),
    note(s + 7, 0, G4, 3), note(s + 7, 3, E4, 1),
    // Phrase B
    note(s + 8, 0, C5, 1.5), note(s + 8, 1.5, B4, 0.5), note(s + 8, 2, A4, 1), note(s + 8, 3, G4, 1),
    note(s + 9, 0, A4, 1), note(s + 9, 1, C5, 1), note(s + 9, 2, C5, 1.5), note(s + 9, 3.5, A4, 0.5),
    note(s + 10, 0, G4, 1), note(s + 10, 1, E4, 1), note(s + 10, 2, G4, 2),
    note(s + 11, 0, D4, 1), note(s + 11, 1, G4, 1), note(s + 11, 2, B4, 1), note(s + 11, 3, C5, 1),
    note(s + 12, 0, A4, 2), note(s + 12, 2, E4, 1), note(s + 12, 3, G4, 1),
    note(s + 13, 0, F4, 1.5), note(s + 13, 1.5, G4, 0.5), note(s + 13, 2, A4, 2),
    note(s + 14, 0, G4, 1), note(s + 14, 1, C5, 1), note(s + 14, 2, B4, 1), note(s + 14, 3, G4, 1),
    note(s + 15, 0, A4, 1), note(s + 15, 1, G4, 1), note(s + 15, 2, A4, 2),
  ];
}

export function createBuiltinSong(): Song {
  const lead = buildLead();
  return {
    title: 'Neon Tide',
    bpm: BPM,
    duration: TOTAL_BARS * BAR,
    lead,
    backing: [
      { name: 'Drums', instrument: 'drums', notes: buildDrums() },
      { name: 'Bass', instrument: 'bass', notes: buildBass() },
      { name: 'Pads', instrument: 'pad', notes: buildPads() },
    ],
    ...computeRegister(lead),
  };
}
