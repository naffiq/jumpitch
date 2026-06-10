import { Midi } from '@tonejs/midi';
import { computeRegister, type InstrumentId, type NoteEvent, type Song } from '../types';

export interface TrackSummary {
  index: number;
  name: string;
  instrumentName: string;
  noteCount: number;
  minMidi: number;
  maxMidi: number;
  avgMidi: number;
  isPercussion: boolean;
}

export interface MidiInfo {
  midi: Midi;
  title: string;
  tracks: TrackSummary[];
  defaultLeadIndex: number;
}

export async function parseMidiFile(file: File): Promise<MidiInfo> {
  const midi = new Midi(await file.arrayBuffer());
  const tracks: TrackSummary[] = [];
  midi.tracks.forEach((track, index) => {
    if (track.notes.length === 0) return;
    const midis = track.notes.map((n) => n.midi);
    tracks.push({
      index,
      name: track.name || `Track ${index + 1}`,
      instrumentName: track.instrument?.name ?? 'unknown',
      noteCount: track.notes.length,
      minMidi: Math.min(...midis),
      maxMidi: Math.max(...midis),
      avgMidi: midis.reduce((a, b) => a + b, 0) / midis.length,
      isPercussion: track.channel === 9,
    });
  });
  if (tracks.length === 0) throw new Error('This MIDI file contains no notes.');

  // Default lead guess: highest average-pitch melodic (non-percussion) track.
  const melodic = tracks.filter((t) => !t.isPercussion);
  const pool = melodic.length > 0 ? melodic : tracks;
  const defaultLead = pool.reduce((best, t) => (t.avgMidi > best.avgMidi ? t : best), pool[0]);

  return {
    midi,
    title: midi.name || file.name.replace(/\.midi?$/i, ''),
    tracks,
    defaultLeadIndex: defaultLead.index,
  };
}

/** GM program number → our 4-instrument synthwave palette. */
function instrumentForTrack(channel: number, program: number): InstrumentId {
  if (channel === 9) return 'drums';
  if (program >= 32 && program <= 39) return 'bass';
  if ((program >= 40 && program <= 55) || (program >= 88 && program <= 95)) return 'pad';
  if (program >= 16 && program <= 23) return 'pad'; // organs
  return 'pluck';
}

/** Collapse chords in the lead to their top note (melody must be monophonic). */
function monophonicTopLine(notes: NoteEvent[]): NoteEvent[] {
  const sorted = [...notes].sort((a, b) => a.time - b.time || b.midi - a.midi);
  const out: NoteEvent[] = [];
  for (const n of sorted) {
    const last = out[out.length - 1];
    if (last && n.time - last.time < 0.03) continue; // same onset → keep top note only
    if (last && n.time < last.time + last.duration) {
      last.duration = Math.max(0.05, n.time - last.time - 0.02); // trim overlaps
    }
    out.push({ ...n });
  }
  return out;
}

export function buildSongFromMidi(info: MidiInfo, leadIndex: number): Song {
  const leadTrack = info.midi.tracks[leadIndex];
  const lead = monophonicTopLine(
    leadTrack.notes.map((n) => ({
      time: n.time,
      midi: n.midi,
      duration: n.duration,
      velocity: n.velocity,
    })),
  );

  const backing = info.midi.tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track, index }) => index !== leadIndex && track.notes.length > 0)
    .map(({ track }) => ({
      name: track.name || 'Track',
      instrument: instrumentForTrack(track.channel, track.instrument?.number ?? 0),
      notes: track.notes.map((n) => ({
        time: n.time,
        midi: n.midi,
        duration: Math.max(0.05, n.duration),
        velocity: n.velocity,
      })),
    }));

  const lastLead = lead[lead.length - 1];
  const duration = Math.max(
    info.midi.duration,
    lastLead ? lastLead.time + lastLead.duration : 0,
  );

  return {
    title: info.title,
    bpm: info.midi.header.tempos[0]?.bpm ?? 120,
    duration,
    lead,
    backing,
    ...computeRegister(lead),
  };
}
