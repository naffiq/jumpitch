// Main menu. Left: searchable grid of karaoke songs. Right (bottom on mobile):
// the mic enable + calibration (which becomes a live pitch preview once the mic
// proves out), capture settings, and the start / upload buttons. The mic +
// pitch engine, once acquired, are handed back to the app so returning to the
// menu skips re-enabling.

import { midiToNoteName } from '../../types';
import { CONFIG } from '../../config';
import type { AudioEngine } from '../../audio/audioEngine';
import { CATALOG } from '../../audio/catalog';
import { initMic, type MicInput } from '../../pitch/micInput';
import { PitchEngine } from '../../pitch/pitchEngine';

export type SongChoice =
  | { catalog: string }
  | { builtin: string }
  | { midiFile: File }
  | { ultrastarText: string; name: string };

export interface StartResult {
  songChoice: SongChoice;
  webcam: boolean;
  includeVoice: boolean;
}

type SongKind = 'catalog' | 'midi' | 'ultrastar';

export interface MenuDeps {
  audio: AudioEngine;
  pitch: PitchEngine | null; // non-null when returning to the menu (mic already live)
}

export function showStartScreen(
  parent: HTMLElement,
  deps: MenuDeps,
  onStart: (result: StartResult) => void,
  onPitchReady: (pitch: PitchEngine) => void,
): () => void {
  const root = document.createElement('div');
  root.className = 'screen menu-screen';

  const cards = CATALOG.map(
    (s, i) => `
      <button class="song-card ${i === 0 ? 'selected' : ''}" data-id="${s.id}"
              data-search="${`${s.title} ${s.meta}`.toLowerCase()}">
        <span class="song-cover" style="${s.cover ? `background-image:url('${s.cover}')` : ''}"></span>
        <span class="song-name">${s.title}</span>
        <span class="song-meta">${s.meta}</span>
      </button>`,
  ).join('');

  root.innerHTML = `
    <div class="menu-main">
      <h1 class="title small">JUMP<span>PITCH</span></h1>
      <input class="song-search" type="search" placeholder="Search songs…" aria-label="Search songs">
      <div class="song-grid">${cards || '<p class="song-empty">No songs yet — drop a folder in src/songs or upload one →</p>'}</div>
    </div>

    <aside class="menu-side">
      <div class="mic-area">
        <button class="btn-mic">Enable Microphone</button>
        <div class="calibration" hidden>
          <div class="cal-readout">
            <span class="cal-note">—</span>
            <span class="cal-hz">hum a comfortable note</span>
          </div>
          <div class="cal-clarity"><div class="cal-clarity-fill"></div></div>
          <p class="cal-hint">🎧 headphones recommended — keeps the backing out of your mic</p>
        </div>
        <div class="pitch-preview" hidden>
          <span class="pp-note">—</span>
          <div class="pp-bar"><div class="pp-fill"></div></div>
          <span class="pp-label">mic live · your pitch</span>
        </div>
      </div>

      <div class="toggles">
        <label class="toggle"><input type="checkbox" class="t-webcam" checked> Webcam bubble</label>
        <label class="toggle"><input type="checkbox" class="t-voice" checked> Record my voice</label>
      </div>

      <div class="menu-actions">
        <button class="btn-start" disabled>Start ▶</button>
        <div class="upload-row">
          <label class="upload-card" data-kind="ultrastar">＋ .txt
            <input type="file" class="txt-input" accept=".txt" hidden>
          </label>
          <label class="upload-card" data-kind="midi">＋ MIDI
            <input type="file" class="midi-input" accept=".mid,.midi" hidden>
          </label>
        </div>
        <div class="midi-chosen" hidden></div>
      </div>
    </aside>
  `;
  parent.appendChild(root);

  let selectedKind: SongKind = 'catalog';
  let selectedCatalogId = CATALOG[0]?.id ?? '';
  let midiFile: File | null = null;
  let ultrastarText: string | null = null;
  let ultrastarName = '';

  let mic: MicInput | null = null;
  let pitch: PitchEngine | null = deps.pitch;
  let live = pitch !== null;
  let rafId = 0;
  let ambientSum = 0;
  let ambientCount = 0;
  let windowTuned = false;

  const songCards = Array.from(root.querySelectorAll<HTMLElement>('.song-card'));
  const search = root.querySelector<HTMLInputElement>('.song-search')!;
  const uploadCards = Array.from(root.querySelectorAll<HTMLElement>('.upload-card'));
  const midiInput = root.querySelector<HTMLInputElement>('.midi-input')!;
  const txtInput = root.querySelector<HTMLInputElement>('.txt-input')!;
  const chosen = root.querySelector<HTMLElement>('.midi-chosen')!;
  const webcamToggle = root.querySelector<HTMLInputElement>('.t-webcam')!;
  const voiceToggle = root.querySelector<HTMLInputElement>('.t-voice')!;
  const startBtn = root.querySelector<HTMLButtonElement>('.btn-start')!;
  const micBtn = root.querySelector<HTMLButtonElement>('.btn-mic')!;
  const calibration = root.querySelector<HTMLElement>('.calibration')!;
  const calNote = root.querySelector<HTMLElement>('.cal-note')!;
  const calHz = root.querySelector<HTMLElement>('.cal-hz')!;
  const calClarityFill = root.querySelector<HTMLElement>('.cal-clarity-fill')!;
  const preview = root.querySelector<HTMLElement>('.pitch-preview')!;
  const ppNote = root.querySelector<HTMLElement>('.pp-note')!;
  const ppFill = root.querySelector<HTMLElement>('.pp-fill')!;

  // ---- song selection ----
  function clearSelection(): void {
    songCards.forEach((c) => c.classList.remove('selected'));
    uploadCards.forEach((c) => c.classList.remove('selected'));
  }

  function selectSong(card: HTMLElement): void {
    clearSelection();
    card.classList.add('selected');
    selectedKind = 'catalog';
    selectedCatalogId = card.dataset.id!;
    updateStartEnabled();
  }

  songCards.forEach((card) => card.addEventListener('click', () => selectSong(card)));

  uploadCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (card.dataset.kind === 'midi') midiInput.click();
      else txtInput.click();
    });
  });

  midiInput.addEventListener('change', () => {
    const file = midiInput.files?.[0] ?? null;
    if (!file) return;
    midiFile = file;
    selectedKind = 'midi';
    clearSelection();
    midiInput.closest('.upload-card')!.classList.add('selected');
    chosen.hidden = false;
    chosen.textContent = `🎵 ${file.name}`;
    updateStartEnabled();
  });

  txtInput.addEventListener('change', async () => {
    const file = txtInput.files?.[0] ?? null;
    if (!file) return;
    ultrastarText = await file.text();
    ultrastarName = file.name;
    selectedKind = 'ultrastar';
    clearSelection();
    txtInput.closest('.upload-card')!.classList.add('selected');
    chosen.hidden = false;
    chosen.textContent = `🎤 ${file.name}`;
    updateStartEnabled();
  });

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const card of songCards) {
      card.hidden = q !== '' && !(card.dataset.search ?? '').includes(q);
    }
  });

  // ---- mic enable + calibration / live preview ----
  micBtn.addEventListener('click', async () => {
    micBtn.disabled = true;
    micBtn.textContent = 'Requesting…';
    try {
      await deps.audio.start(); // AudioContext resume on user gesture
      mic = await initMic(deps.audio.context, {
        minFreq: CONFIG.worklet.defaultMinFreq,
        maxFreq: CONFIG.worklet.maxFreq,
        hopSize: CONFIG.worklet.hopSize,
      });
      deps.audio.connectMic(mic.source);
      pitch = new PitchEngine(mic);
      micBtn.hidden = true;
      calibration.hidden = false;
      startSampling();
    } catch (err) {
      micBtn.disabled = false;
      micBtn.textContent = 'Enable Microphone';
      calibration.hidden = false;
      calHz.textContent = `mic error: ${(err as Error).message}`;
    }
  });

  function goLive(): void {
    if (live) return;
    live = true;
    calibration.hidden = true;
    preview.hidden = false;
    onPitchReady(pitch!);
    updateStartEnabled();
  }

  function startSampling(): void {
    cancelAnimationFrame(rafId);
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!pitch) return;
      const raw = pitch.sampleRaw();
      const clarity = raw.clarity;
      const noteName =
        raw.midiFloat !== null && clarity > CONFIG.clarityThreshold
          ? midiToNoteName(raw.midiFloat)
          : '—';

      if (!live) {
        if (raw.freq === null) {
          ambientSum += raw.rms;
          ambientCount++;
          if (ambientCount === 60) pitch.setAmbientRms(ambientSum / ambientCount);
        }
        calClarityFill.style.width = `${Math.min(100, clarity * 100)}%`;
        calNote.textContent = noteName;
        if (raw.midiFloat !== null && clarity > CONFIG.clarityThreshold) {
          calHz.textContent = `${Math.round(raw.freq!)} Hz · clarity ${clarity.toFixed(2)}`;
          if (!windowTuned) {
            windowTuned = true;
            pitch.setExpectedLowMidi(raw.midiFloat - 12);
          }
          goLive();
        }
      } else {
        ppFill.style.width = `${Math.min(100, clarity * 100)}%`;
        ppNote.textContent = noteName;
      }
    };
    loop();
  }

  // ---- start ----
  function updateStartEnabled(): void {
    const songOk =
      selectedKind === 'midi'
        ? midiFile !== null
        : selectedKind === 'ultrastar'
          ? ultrastarText !== null
          : selectedCatalogId !== '';
    startBtn.disabled = !(live && songOk);
  }

  function currentChoice(): SongChoice {
    if (selectedKind === 'midi' && midiFile) return { midiFile };
    if (selectedKind === 'ultrastar' && ultrastarText) return { ultrastarText, name: ultrastarName };
    return { catalog: selectedCatalogId };
  }

  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;
    cancelAnimationFrame(rafId);
    onStart({
      songChoice: currentChoice(),
      webcam: webcamToggle.checked,
      includeVoice: voiceToggle.checked,
    });
  });

  // If the mic is already live (returning to the menu), show the preview now.
  if (live) {
    micBtn.hidden = true;
    preview.hidden = false;
    startSampling();
  }
  updateStartEnabled();

  return () => {
    cancelAnimationFrame(rafId);
    root.remove();
  };
}
