// Vertical lane meter: marker = your folded pitch, band = the current target
// note. The single most important affordance for learning the game.

import { midiToNoteName } from '../types';

export class PitchMeter {
  readonly el: HTMLElement;
  private marker: HTMLElement;
  private band: HTMLElement;
  private note: HTMLElement;
  private guide: HTMLElement;
  private minMidi = 55;
  private maxMidi = 79;
  private noteMidi: number | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'pitch-meter';
    this.note = document.createElement('div');
    this.note.className = 'pitch-meter-note';
    this.guide = document.createElement('div');
    this.guide.className = 'pitch-meter-guide';
    this.band = document.createElement('div');
    this.band.className = 'pitch-meter-band';
    this.marker = document.createElement('div');
    this.marker.className = 'pitch-meter-marker';
    this.el.append(this.note, this.guide, this.band, this.marker);
  }

  setRange(minMidi: number, maxMidi: number): void {
    this.minMidi = minMidi - 3;
    this.maxMidi = maxMidi + 3;
  }

  private toPct(midi: number): number {
    const t = (midi - this.minMidi) / (this.maxMidi - this.minMidi);
    return (1 - Math.max(0, Math.min(1, t))) * 100;
  }

  update(foldedMidi: number | null, targetMidi: number | null, inTolerance: boolean): void {
    if (foldedMidi === null) {
      this.marker.style.opacity = '0';
    } else {
      this.marker.style.opacity = '1';
      this.marker.style.top = `${this.toPct(foldedMidi)}%`;
      this.marker.classList.toggle('on-target', inTolerance);
    }
    if (targetMidi === null) {
      this.band.style.opacity = '0';
      if (this.noteMidi !== null) {
        this.noteMidi = null;
        this.note.textContent = '';
      }
    } else {
      this.band.style.opacity = '1';
      const top = this.toPct(targetMidi + 1.5);
      const bottom = this.toPct(targetMidi - 1.5);
      this.band.style.top = `${top}%`;
      this.band.style.height = `${bottom - top}%`;
      const rounded = Math.round(targetMidi);
      if (rounded !== this.noteMidi) {
        this.noteMidi = rounded;
        this.note.textContent = midiToNoteName(rounded);
      }
    }
  }
}
