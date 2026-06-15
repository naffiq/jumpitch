// UltraStar files carry only the sung melody — no accompaniment track. To give
// the player something to sing over, synthesize a minimal backing from the lead
// melody: a four-on-the-floor drum groove plus a bass that follows the melody's
// root each beat. The groove is PHASE-ALIGNED to the song's beat grid (anchor +
// n*beatSec) so the drums land with the melody/lyrics instead of drifting.
//
// Drum midi conventions match makeDrums() in backingInstruments.ts:
//   36 = kick, 38 = snare, 42 = hat.

import type { BackingTrack, NoteEvent } from '../types';

/**
 * @param lead     melody (for bass roots)
 * @param beatSec  musical beat length in seconds
 * @param anchor   a time (seconds) that lies on a beat of the song's grid
 * @param duration total song length to cover
 */
export function synthesizeBacking(
  lead: NoteEvent[],
  beatSec: number,
  anchor: number,
  duration: number,
): BackingTrack[] {
  const drums: NoteEvent[] = [];
  const bass: NoteEvent[] = [];

  for (let n = Math.ceil((0 - anchor) / beatSec); ; n++) {
    const t = anchor + n * beatSec;
    if (t > duration) break;
    if (t < 0) continue;

    drums.push({ time: t, midi: 36, duration: beatSec * 0.25, velocity: 1 }); // kick
    const inBar = ((n % 4) + 4) % 4;
    if (inBar === 1 || inBar === 3) {
      drums.push({ time: t, midi: 38, duration: beatSec * 0.25, velocity: 0.85 }); // backbeat
    }
    drums.push({ time: t + beatSec * 0.5, midi: 42, duration: beatSec * 0.125, velocity: 0.45 }); // hat

    const root = rootAt(lead, t, t + beatSec);
    if (root !== null) bass.push({ time: t, midi: root - 24, duration: beatSec * 0.9, velocity: 0.8 });
  }

  return [
    { name: 'Drums', instrument: 'drums', notes: drums },
    { name: 'Bass', instrument: 'bass', notes: bass },
  ];
}

/** Lowest lead note sounding anywhere in [from, to); a cheap "chord root". */
function rootAt(lead: NoteEvent[], from: number, to: number): number | null {
  let lowest: number | null = null;
  for (const n of lead) {
    if (n.time >= to || n.time + n.duration <= from) continue;
    if (lowest === null || n.midi < lowest) lowest = n.midi;
  }
  return lowest;
}
