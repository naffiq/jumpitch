import type { LyricLine } from '../types';

// Classic karaoke line at the bottom of the screen: the current lyric line with
// a per-syllable highlight that fills as each note is sung, plus a dimmed
// preview of the next line. Synced to the audible backing clock (audio.time),
// NOT the latency-compensated judging time.

interface Line {
  startTime: number;
  endTime: number;
  syllables: { time: number; duration: number; text: string; golden: boolean }[];
}

const COUNT_IN = 3; // seconds of "3 · 2 · 1" before the first lyric

export class KaraokeBar {
  private root: HTMLElement;
  private currentEl: HTMLElement;
  private nextEl: HTMLElement;
  private countinEl: HTMLElement;
  private lines: Line[];
  private firstStart = 0;
  private count = 0;
  private index = -1;
  private spans: { el: HTMLElement; time: number; duration: number }[] = [];

  constructor(parent: HTMLElement, lyricLines: LyricLine[]) {
    this.lines = lyricLines.map((line) => ({
      startTime: line.startTime,
      endTime: line.notes.reduce((m, n) => Math.max(m, n.time + n.duration), line.startTime),
      syllables: line.notes.map((n) => ({
        time: n.time,
        duration: n.duration,
        text: n.syllable ?? '',
        golden: n.golden ?? false,
      })),
    }));

    this.firstStart = this.lines[0]?.startTime ?? 0;

    this.root = document.createElement('div');
    this.root.className = 'karaoke-bar';
    this.root.innerHTML = `<div class="kbar-current"></div><div class="kbar-next"></div>`;
    this.currentEl = this.root.querySelector('.kbar-current')!;
    this.nextEl = this.root.querySelector('.kbar-next')!;
    if (this.lines.length === 0) this.root.hidden = true;
    parent.appendChild(this.root);

    // The count-in sits centered on screen, not inside the bottom bar.
    this.countinEl = document.createElement('div');
    this.countinEl.className = 'karaoke-countin';
    parent.appendChild(this.countinEl);
  }

  tick(t: number): void {
    if (this.lines.length === 0) return;

    this.updateCountIn(t);

    // Current = first line still ahead of (or covering) the clock; shows the
    // upcoming line a little early during the gaps between lines.
    let idx = this.lines.findIndex((l) => l.endTime >= t);
    if (idx === -1) idx = this.lines.length - 1;
    if (idx !== this.index) {
      this.index = idx;
      this.renderLine(idx);
    }

    for (const s of this.spans) {
      const p = Math.max(0, Math.min(1, (t - s.time) / Math.max(0.001, s.duration)));
      s.el.style.setProperty('--p', String(p));
    }
  }

  private updateCountIn(t: number): void {
    const remaining = this.firstStart - t;
    const n = remaining > 0 && remaining <= COUNT_IN ? Math.ceil(remaining - 0.001) : 0;
    if (n === this.count) return;
    this.count = n;
    if (n > 0) {
      this.countinEl.textContent = String(n);
      this.countinEl.classList.remove('pop');
      void this.countinEl.offsetWidth; // restart the pop animation
      this.countinEl.classList.add('show', 'pop');
    } else {
      this.countinEl.classList.remove('show', 'pop');
    }
  }

  private renderLine(idx: number): void {
    this.currentEl.replaceChildren();
    this.spans = [];
    for (const syl of this.lines[idx].syllables) {
      const el = document.createElement('span');
      el.className = syl.golden ? 'kbar-syl kbar-golden' : 'kbar-syl';
      el.textContent = syl.text;
      el.style.setProperty('--p', '0');
      this.currentEl.appendChild(el);
      this.spans.push({ el, time: syl.time, duration: syl.duration });
    }
    const next = this.lines[idx + 1];
    this.nextEl.textContent = next ? next.syllables.map((s) => s.text).join('') : '';
  }

  dispose(): void {
    this.root.remove();
    this.countinEl.remove();
  }
}
