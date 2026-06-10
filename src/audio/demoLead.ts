// Plays the "call" notes of a call-and-response song automatically on the lead
// synth, so the player hears the example before echoing it. Visual platform
// flashes are scheduled on Tone.Draw so they line up with the audio.

import * as Tone from 'tone';
import type { NoteEvent } from '../types';
import type { LeadSynth } from './leadSynth';

export interface DemoNote {
  note: NoteEvent;
  index: number; // platform index, for the visual flash
}

export class DemoLead {
  private ids: number[] = [];

  constructor(lead: LeadSynth, notes: DemoNote[], onPlay: (index: number) => void) {
    const transport = Tone.getTransport();
    for (const { note, index } of notes) {
      const id = transport.schedule((time) => {
        lead.playAt(note.midi, note.duration, time);
        Tone.getDraw().schedule(() => onPlay(index), time);
      }, note.time);
      this.ids.push(id);
    }
  }

  dispose(): void {
    const transport = Tone.getTransport();
    this.ids.forEach((id) => transport.clear(id));
    this.ids = [];
  }
}
