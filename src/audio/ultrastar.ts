// Parser for the UltraStar .txt karaoke format (UltraStar Deluxe / Vocaluxe /
// Performous). It encodes pitch + timing + syllable together, which maps almost
// 1:1 onto our NoteEvent model — the lead melody doubles as the level layout.
//
// File shape:
//   #TITLE:...      #ARTIST:...   #BPM:...   #GAP:<ms>   #COVER:...   #MP3:...
//   : <startBeat> <lengthBeats> <pitch> <syllable>   normal note
//   * ...                                            golden (bonus) note
//   F ...                                            freestyle note
//   R/G ...                                          rap notes (treated as normal)
//   - <beat>                                         line break (new lyric line)
//   E                                                end
//
// Timing — verified against real files by total-length match:
//   one UltraStar "beat" = 60 / (BPM * 4) seconds (15000/BPM ms), and
//   time = #GAP/1000 + startBeat * beatSeconds. pitch is relative; midi = pitch + 60.
//
// NOTE the file's #BPM is a *grid resolution*, NOT the musical tempo — charters
// pick it (often a 2×/4× multiple) for the granularity they want. So the drum /
// bass groove tempo is derived separately (musicalBpm) rather than from #BPM.

import { computeRegister, type LyricLine, type NoteEvent, type Song, type SongVideo } from '../types';
import { synthesizeBacking } from './autoBacking';

const MIN_INTRO = 3.2; // seconds; lead-in long enough for a 3·2·1 count (also absorbs a small/negative #GAP)
const MAX_INTRO = 8; // seconds; cap an overlong #GAP so the player isn't left waiting
const TAIL = 2; // seconds of run-out after the last note

interface Headers {
  title: string;
  artist: string;
  bpm: number;
  gapMs: number;
  video?: SongVideo;
}

export class UltraStarParseError extends Error {}

export function parseUltraStar(
  text: string,
  opts: { cover?: string; midiUrl?: string } = {},
): Song {
  const lines = text.split(/\r?\n/);
  const headers = readHeaders(lines);
  const beatSeconds = 60 / (headers.bpm * 4);
  const gap = headers.gapMs / 1000;

  // #MIDI (when a .mid is available) plays the real arrangement and takes
  // precedence over #VIDEO. Both anchor to the absolute song clock, so neither
  // gets the synth-song intro shift.
  const useMidi = !!opts.midiUrl;
  const video = useMidi ? undefined : headers.video;

  const lead: NoteEvent[] = [];
  const rawLines: NoteEvent[][] = [];
  let current: NoteEvent[] = [];

  // Trailing capture is optional so a text-less note still parses. Match against
  // a left-trimmed line so any trailing space (a word separator in many files)
  // is preserved in the syllable.
  const noteRe = /^([*:FRG])\s+(-?\d+)\s+(\d+)\s+(-?\d+)(?:\s(.*))?$/;
  for (const raw of lines) {
    const head = raw.replace(/^\s+/, ''); // trim leading only — keep trailing spaces
    if (head === '' || head.startsWith('#')) continue;
    if (head[0] === 'E') break;

    if (head[0] === '-') {
      // Line break: close the current lyric line.
      if (current.length) rawLines.push(current);
      current = [];
      continue;
    }

    const m = noteRe.exec(head);
    if (!m) continue; // tolerate stray/unknown lines
    const [, type, startBeat, lengthBeats, pitch, rawSyllable] = m;
    const note: NoteEvent = {
      time: gap + Number(startBeat) * beatSeconds,
      duration: Math.max(0.05, Number(lengthBeats) * beatSeconds),
      midi: Number(pitch) + 60,
      velocity: type === '*' ? 1 : 0.9,
      // "~" marks a held continuation of the previous vowel — strip it so the
      // lyrics read as words ("fi"+"~"+"~re" → "fi"+""+"re" → "fire").
      syllable: (rawSyllable ?? '').replace(/~/g, ''),
      golden: type === '*',
      freestyle: type === 'F',
    };
    lead.push(note);
    current.push(note);
  }
  if (current.length) rawLines.push(current);

  if (lead.length === 0) throw new UltraStarParseError('No singable notes found in the file.');

  // For video songs, note times must stay aligned to the real audio/video clock
  // (#GAP is already baked in), so DON'T re-shift. For synth songs, keep the
  // file's intro but clamp it: at least MIN_INTRO (covers a small/negative #GAP),
  // at most MAX_INTRO.
  const firstRaw = lead[0].time;
  const offset = video || useMidi ? 0 : Math.min(MAX_INTRO, Math.max(MIN_INTRO, firstRaw)) - firstRaw;
  if (offset !== 0) for (const n of lead) n.time += offset;

  const lyricLines: LyricLine[] = rawLines.map((notes) => ({
    startTime: notes[0].time,
    notes,
  }));

  const last = lead[lead.length - 1];
  const duration = last.time + last.duration + TAIL;
  // The backing groove rides the song's beat grid: anchor on file-beat 0 (= the
  // shifted #GAP) and step by a musical beat phase-locked to the melody. Video
  // songs use the real track for backing, so skip the synth.
  const beatSec = musicalBeat(beatSeconds);
  const bpm = 60 / beatSec;
  const anchor = offset + gap;
  // Video songs use the real track; MIDI songs replace this synth backing once
  // the .mid loads (it stays as a fallback if that fails).
  const backing = video ? [] : synthesizeBacking(lead, beatSec, anchor, duration);

  return {
    title: headers.title,
    bpm,
    duration,
    lead,
    backing,
    ...computeRegister(lead),
    lyricLines,
    cover: opts.cover,
    video,
    midiUrl: useMidi ? opts.midiUrl : undefined,
  };
}

// The #BPM only sets the beat *grid*, not the felt tempo. Pick a backing-beat
// length that is a power-of-two multiple of the grid beat and lands closest to
// ~0.5s (≈120 BPM), so the synthesized groove feels musical regardless of how
// fine the charter's grid is. (Adele @ #BPM 210 → 0.57s/105 BPM; Twinkle @ 100 → 0.6s/100 BPM.)
function musicalBeat(beatSeconds: number): number {
  const TARGET = 0.5;
  let best = 1;
  for (const k of [1, 2, 4, 8, 16]) {
    if (Math.abs(k * beatSeconds - TARGET) < Math.abs(best * beatSeconds - TARGET)) best = k;
  }
  return best * beatSeconds;
}

function readHeaders(lines: string[]): Headers {
  const get = (key: string): string | null => {
    const prefix = `#${key}:`;
    for (const line of lines) {
      if (line.toUpperCase().startsWith(prefix)) return line.slice(prefix.length).trim();
    }
    return null;
  };
  // European exports use comma decimals.
  const num = (s: string | null): number => (s === null ? NaN : Number(s.replace(',', '.')));

  const bpm = num(get('BPM'));
  if (!Number.isFinite(bpm) || bpm <= 0) {
    throw new UltraStarParseError('Missing or invalid #BPM header.');
  }
  const gapMs = num(get('GAP'));
  const artist = get('ARTIST') ?? '';
  const title = get('TITLE') ?? (artist ? `${artist} — untitled` : 'Untitled');

  return {
    title,
    artist,
    bpm,
    gapMs: Number.isFinite(gapMs) ? gapMs : 0,
    video: parseVideo(get('VIDEO'), num(get('VIDEOGAP'))),
  };
}

/** #VIDEO is a comma list like "v=<id>,co=...,bg=..."; we only need the YouTube id. */
export function parseVideo(field: string | null, videoGap: number): SongVideo | undefined {
  if (!field) return undefined;
  const m = /(?:^|,)\s*v=([\w-]{6,})/.exec(field);
  if (!m) return undefined;
  return { youtubeId: m[1], gap: Number.isFinite(videoGap) ? videoGap : 0 };
}
