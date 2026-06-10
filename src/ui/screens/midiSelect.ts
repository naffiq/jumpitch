// After a MIDI upload: list tracks and let the player confirm/override which
// track is the lead melody. Defaults to the highest-average-pitch melodic track.

import { midiToNoteName } from '../../types';
import type { MidiInfo } from '../../audio/midiLoader';

export function showMidiSelect(
  parent: HTMLElement,
  info: MidiInfo,
  onConfirm: (leadIndex: number) => void,
  onCancel: () => void,
): () => void {
  const root = document.createElement('div');
  root.className = 'screen midi-screen';
  let selected = info.defaultLeadIndex;

  const rows = info.tracks
    .map(
      (t) => `
      <label class="track-row ${t.index === selected ? 'selected' : ''}" data-index="${t.index}">
        <input type="radio" name="lead" value="${t.index}" ${t.index === selected ? 'checked' : ''} hidden>
        <span class="track-name">${escapeHtml(t.name)}${t.isPercussion ? ' 🥁' : ''}</span>
        <span class="track-meta">${t.noteCount} notes · ${midiToNoteName(t.minMidi)}–${midiToNoteName(t.maxMidi)} · ${escapeHtml(t.instrumentName)}</span>
      </label>`,
    )
    .join('');

  root.innerHTML = `
    <div class="start-panel">
      <h2 class="title small">${escapeHtml(info.title)}</h2>
      <p class="subtitle">Which track is the lead melody? (you'll sing this one)</p>
      <div class="track-list">${rows}</div>
      <div class="midi-actions">
        <button class="btn-secondary btn-back">← Back</button>
        <button class="btn-start btn-confirm">Use this track</button>
      </div>
    </div>
  `;
  parent.appendChild(root);

  const trackRows = Array.from(root.querySelectorAll<HTMLElement>('.track-row'));
  trackRows.forEach((row) => {
    row.addEventListener('click', () => {
      selected = Number(row.dataset.index);
      trackRows.forEach((r) => r.classList.toggle('selected', r === row));
    });
  });

  root.querySelector('.btn-confirm')!.addEventListener('click', () => onConfirm(selected));
  root.querySelector('.btn-back')!.addEventListener('click', onCancel);

  return () => root.remove();
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
