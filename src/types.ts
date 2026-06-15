export interface NoteEvent {
  time: number; // seconds from song start
  midi: number;
  duration: number; // seconds
  velocity?: number; // 0..1
  demo?: boolean; // call-and-response: the synth demonstrates this note (not sung/scored)
  syllable?: string; // karaoke: the word fragment sung on this note (UltraStar)
  golden?: boolean; // karaoke: UltraStar "*" bonus note
  freestyle?: boolean; // karaoke: UltraStar "F" freestyle note (sung, but loosely scored)
}

export type InstrumentId = 'drums' | 'bass' | 'pad' | 'pluck';

export interface BackingTrack {
  name: string;
  instrument: InstrumentId;
  notes: NoteEvent[];
}

/** A karaoke line: the run of notes between UltraStar "-" line breaks. */
export interface LyricLine {
  startTime: number; // seconds; onset of the first note in the line
  notes: NoteEvent[];
}

export interface Song {
  title: string;
  bpm: number;
  duration: number; // seconds
  lead: NoteEvent[]; // sorted by time; melody == level layout
  backing: BackingTrack[];
  registerCenter: number;
  registerMin: number;
  registerMax: number;
  lyricLines?: LyricLine[]; // karaoke songs only; drives the on-screen lyrics
  cover?: string; // karaoke songs only; cover-image URL for the song card
  video?: SongVideo; // karaoke songs with a YouTube backing video (UltraStar #VIDEO)
  midiUrl?: string; // karaoke songs whose backing comes from a MIDI file (UltraStar #MIDI)
}

export interface SongVideo {
  youtubeId: string;
  gap: number; // seconds; #VIDEOGAP — video start relative to the song clock
}

export type Grade = 'perfect' | 'good' | 'miss';

export interface RunStats {
  score: number;
  maxStreak: number;
  notesHit: number;
  notesTotal: number;
  perfects: number;
  goods: number;
  spikeHits: number;
  accuracy: number; // 0..1
  failed: boolean;
}

/** Compute register fields from a lead melody (median + min/max midi). */
export function computeRegister(lead: NoteEvent[]): {
  registerCenter: number;
  registerMin: number;
  registerMax: number;
} {
  if (lead.length === 0) return { registerCenter: 60, registerMin: 55, registerMax: 67 };
  const midis = lead.map((n) => n.midi).sort((a, b) => a - b);
  const mid = midis[Math.floor(midis.length / 2)];
  return { registerCenter: mid, registerMin: midis[0], registerMax: midis[midis.length - 1] };
}

export function midiToNoteName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const m = Math.round(midi);
  return `${names[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
