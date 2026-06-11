// Owns the single Tone.js context, the Transport (the game clock), and the
// master/record routing graph:
//
//   mic ──► analyser (pitch only, inaudible)
//   mic ──► micGain (opt-in) ──► recordDest ────────────────┐
//   backing + lead + sfx ──► Tone.Destination ──► speakers  │
//                                  └──► recordDest ─────────┴─► MediaRecorder
//
// The mic NEVER reaches Destination, so there is no feedback path.

import * as Tone from 'tone';
import type { Song } from '../types';
import { createBackingInstrument, type BackingInstrument } from './backingInstruments';

export class AudioEngine {
  readonly context: AudioContext;
  readonly recordDest: MediaStreamAudioDestinationNode;
  readonly micGain: GainNode;

  private parts: Tone.Part[] = [];
  private instruments: BackingInstrument[] = [];
  private endEventId: number | null = null;
  private started = false;

  constructor() {
    this.context = Tone.getContext().rawContext as AudioContext;
    this.recordDest = this.context.createMediaStreamDestination();
    this.micGain = this.context.createGain();
    this.micGain.gain.value = 0;
    this.micGain.connect(this.recordDest);
    Tone.getDestination().connect(this.recordDest);
  }

  /** Must be called from a user gesture (autoplay policy). */
  async start(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    this.started = true;
  }

  connectMic(source: MediaStreamAudioSourceNode): void {
    source.connect(this.micGain);
  }

  /** Resume the context if anything (tab switch, a dialog) suspended it. */
  ensureRunning(): void {
    const ctx = this.context as unknown as { state: string; resume: () => Promise<void> };
    if (ctx.state !== 'running') void ctx.resume();
  }

  /** Include raw voice in the recording mix. */
  setMicInRecording(enabled: boolean): void {
    this.micGain.gain.value = enabled ? 1 : 0;
  }

  loadSong(song: Song, onEnd: () => void): void {
    this.unloadSong();
    const transport = Tone.getTransport();
    transport.bpm.value = song.bpm;

    for (const track of song.backing) {
      const instr = createBackingInstrument(track.instrument);
      this.instruments.push(instr);
      const part = new Tone.Part(
        (time, note) => instr.trigger(note, time),
        track.notes.map((n) => [n.time, n] as const),
      );
      part.start(0);
      this.parts.push(part);
    }

    this.endEventId = transport.schedule(() => onEnd(), song.duration + 1.5);
  }

  play(): void {
    Tone.getTransport().start('+0.1');
  }

  /** Freeze the game clock (and everything scheduled on it) for a pause. */
  pause(): void {
    Tone.getTransport().pause();
  }

  /** Resume from the paused position. */
  resume(): void {
    Tone.getTransport().start();
  }

  stop(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
  }

  /** The single game clock. */
  get time(): number {
    return Tone.getTransport().seconds;
  }

  get playing(): boolean {
    return Tone.getTransport().state === 'started';
  }

  unloadSong(): void {
    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.position = 0;
    if (this.endEventId !== null) {
      transport.clear(this.endEventId);
      this.endEventId = null;
    }
    this.parts.forEach((p) => p.dispose());
    this.parts = [];
    this.instruments.forEach((i) => i.dispose());
    this.instruments = [];
  }
}
