// Musical hit judging: each lead note has a time window [t - pad, t + dur + pad].
// A frame is "on" when the player is voiced within ±1.5 semitones of the note.
// The lead synth attacks on the first on-frame and releases when the player
// falls off, so sustained notes audibly cut out when you stop singing them.
// A note is judged hit when on-time covers >= 50% of its duration.

import { CONFIG } from '../config';
import type { Grade, NoteEvent, Song } from '../types';
import type { LeadSynth } from '../audio/leadSynth';
import { midiToY } from './mapping';

interface NoteState {
  onTime: number;
  errSum: number;
  onFrames: number;
  offStreak: number;
  attacked: boolean;
  judged: boolean;
}

export class HitJudge {
  private states: NoteState[];
  private cursor = 0; // first not-yet-finished note
  private tolerance = CONFIG.hitToleranceSemitones * CONFIG.semitoneHeight;
  private lastMatch = -1; // last setMatch target, to avoid re-ramping every frame
  readonly responseCount: number; // notes the player actually has to sing

  constructor(
    private song: Song,
    private lead: LeadSynth,
    private onJudged: (note: NoteEvent, noteIndex: number, grade: Grade) => void,
    private onNoteOn: (noteIndex: number) => void,
  ) {
    this.states = song.lead.map(() => ({
      onTime: 0,
      errSum: 0,
      onFrames: 0,
      offStreak: 0,
      attacked: false,
      judged: false,
    }));
    this.responseCount = song.lead.filter((n) => !n.demo).length;
  }

  /** t is latency-compensated transport time. */
  update(t: number, dt: number, voiced: boolean, sphereY: number): void {
    const notes = this.song.lead;
    let referenceActive = false;

    for (let i = this.cursor; i < notes.length; i++) {
      const note = notes[i];
      const winStart = note.time - CONFIG.hitWindowPad;
      const winEnd = note.time + note.duration + CONFIG.hitWindowPad;
      if (t < winStart) break; // notes are time-sorted
      const state = this.states[i];

      // Demo (teacher) notes aren't sung — pass straight through, no scoring.
      if (note.demo) {
        if (t > winEnd) {
          state.judged = true;
          if (i === this.cursor) this.cursor++;
        }
        continue;
      }

      if (t > winEnd) {
        if (!state.judged) this.judge(i);
        if (i === this.cursor) this.cursor++;
        continue;
      }

      const platformY = midiToY(note.midi, this.song.registerCenter);
      const on = voiced && Math.abs(sphereY - platformY) <= this.tolerance;

      // Scoring (lenient padded window).
      if (on) {
        state.onTime += dt;
        state.onFrames++;
        state.errSum += Math.abs(sphereY - platformY) / CONFIG.semitoneHeight;
        state.offStreak = 0;
        if (!state.attacked) {
          state.attacked = true;
          this.onNoteOn(i); // platform flash on the first clean frame
        }
      } else if (state.attacked) {
        state.offStreak++;
      }

      // Reference guide: sound the true note across its real span (not the pad)
      // so the player has something to match — muffled off-pitch, bright on.
      if (t >= note.time && t < note.time + note.duration) {
        referenceActive = true;
        if (this.lead.playingMidi !== note.midi) {
          this.lead.attack(note.midi);
          this.lastMatch = -1;
        }
        const q = on ? 1 : 0;
        if (q !== this.lastMatch) {
          this.lead.setMatch(q);
          this.lastMatch = q;
        }
      }
    }

    if (!referenceActive && this.lead.playingMidi !== null) {
      this.lead.release();
      this.lastMatch = -1;
    }
  }

  private judge(i: number): void {
    const state = this.states[i];
    const note = this.song.lead[i];
    state.judged = true;
    if (this.lead.playingMidi === note.midi) this.lead.release();

    const coverage = note.duration > 0 ? Math.min(1, state.onTime / note.duration) : 1;
    const isShort = note.duration < CONFIG.shortNoteDuration;
    const hit = isShort ? state.onFrames > 0 : coverage >= CONFIG.hitCoverage;
    let grade: Grade = 'miss';
    if (hit) {
      const avgErr = state.onFrames > 0 ? state.errSum / state.onFrames : 99;
      grade =
        coverage >= CONFIG.perfectCoverage && avgErr <= CONFIG.perfectAvgError
          ? 'perfect'
          : isShort && avgErr <= CONFIG.perfectAvgError
            ? 'perfect'
            : 'good';
    }
    this.onJudged(note, i, grade);
  }

  /** Flush remaining response notes at song end so every one gets judged. */
  finish(): void {
    for (let i = this.cursor; i < this.song.lead.length; i++) {
      if (this.states[i].judged) continue;
      if (this.song.lead[i].demo) this.states[i].judged = true;
      else this.judge(i);
    }
    this.cursor = this.song.lead.length;
    this.lead.release();
  }

  /** Current target for the HUD pitch meter: active note, else next within 2s. */
  currentTarget(t: number): NoteEvent | null {
    for (let i = this.cursor; i < this.song.lead.length; i++) {
      const note = this.song.lead[i];
      if (t < note.time - 2) return null;
      if (t <= note.time + note.duration + CONFIG.hitWindowPad) return note;
    }
    return null;
  }
}
