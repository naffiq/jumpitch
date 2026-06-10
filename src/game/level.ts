import { CONFIG } from '../config';
import type { NoteEvent, Song } from '../types';
import { midiToY, timeToZ } from './mapping';

export interface PlatformDef {
  note: NoteEvent;
  noteIndex: number;
  y: number;
  zStart: number; // note onset (closer to camera start)
  zEnd: number; // note end (further along -Z)
  demo: boolean; // teacher's example note vs the player's to sing
}

export interface SpikeRowDef {
  y: number;
  zStart: number;
  zEnd: number;
  count: number;
}

export interface Level {
  platforms: PlatformDef[];
  spikeRows: SpikeRowDef[];
}

export function buildLevel(song: Song): Level {
  const platforms: PlatformDef[] = song.lead.map((note, noteIndex) => ({
    note,
    noteIndex,
    y: midiToY(note.midi, song.registerCenter),
    zStart: timeToZ(note.time),
    zEnd: timeToZ(note.time + note.duration),
    demo: !!note.demo,
  }));

  const spikeRows: SpikeRowDef[] = [];
  for (const note of song.lead) {
    if (note.demo) continue; // don't hang spikes over the teacher's example
    if (note.duration < CONFIG.spikeMinNoteDuration) continue;
    const spikeMidi = note.midi + CONFIG.spikeOffsetSemitones;
    // Never block a legitimate path: skip if a nearby note reaches spike height.
    const blocked = song.lead.some(
      (other) =>
        other !== note &&
        Math.abs(other.time - note.time) < CONFIG.spikeClearanceWindow &&
        other.midi >= spikeMidi,
    );
    if (blocked) continue;
    const zStart = timeToZ(note.time);
    const zEnd = timeToZ(note.time + note.duration);
    const span = Math.abs(zEnd - zStart);
    spikeRows.push({
      y: midiToY(spikeMidi, song.registerCenter),
      zStart,
      zEnd,
      count: Math.max(2, Math.round(span / 1.2)),
    });
  }

  return { platforms, spikeRows };
}
