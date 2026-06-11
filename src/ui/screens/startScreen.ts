// Start screen: song select, webcam/voice toggles, mic enable (also the
// user-gesture that starts the AudioContext), and a live calibration strip
// that measures ambient noise and proves pitch detection works before play.

import { midiToNoteName } from '../../types';
import { CONFIG } from '../../config';
import type { AudioEngine } from '../../audio/audioEngine';
import { BUILTIN_SONGS } from '../../audio/builtinSongs';
import { initMic, type MicInput } from '../../pitch/micInput';
import { PitchEngine } from '../../pitch/pitchEngine';

export interface StartResult {
  songChoice: { builtin: string } | { midiFile: File };
  webcam: boolean;
  includeVoice: boolean;
  mic: MicInput;
  pitch: PitchEngine;
}

export function showStartScreen(
  parent: HTMLElement,
  audio: AudioEngine,
  onStart: (result: StartResult) => void,
): () => void {
  const root = document.createElement('div');
  root.className = 'screen start-screen';

  const builtinCards = BUILTIN_SONGS.map(
    (s, i) => `
      <label class="song-card ${i === 0 ? 'selected' : ''}" data-kind="builtin" data-id="${s.id}">
        <span class="song-name">${s.title}</span>
        <span class="song-meta">${s.meta}</span>
      </label>`,
  ).join('');

  root.innerHTML = `
    <div class="start-panel">
      <h1 class="title">JUMP<span>PITCH</span></h1>
      <p class="subtitle">sing the melody · ride the neon · become the song</p>

      <div class="song-select">
        ${builtinCards}
        <label class="song-card" data-kind="midi">
          <span class="song-name">Upload MIDI ↑</span>
          <span class="song-meta">your own track</span>
          <input type="file" class="midi-input" accept=".mid,.midi" hidden>
        </label>
      </div>
      <div class="midi-chosen" hidden></div>

      <div class="toggles">
        <label class="toggle"><input type="checkbox" class="t-webcam" checked> Webcam bubble</label>
        <label class="toggle"><input type="checkbox" class="t-voice" checked> Record my voice too</label>
      </div>

      <div class="mic-area">
        <button class="btn-mic">Enable Microphone</button>
        <div class="calibration" hidden>
          <div class="cal-readout">
            <span class="cal-note">—</span>
            <span class="cal-hz">hum a comfortable note</span>
          </div>
          <div class="cal-clarity"><div class="cal-clarity-fill"></div></div>
          <p class="cal-hint">🎧 headphones recommended — keeps the backing track out of your mic</p>
        </div>
      </div>

      <button class="btn-start" disabled>Start Run</button>
      <p class="footnote">Higher pitch = sphere rises. Land on platforms in time to play the melody. Mind the spikes.</p>
    </div>
  `;
  parent.appendChild(root);

  let mic: MicInput | null = null;
  let pitch: PitchEngine | null = null;
  let midiFile: File | null = null;
  let selectedKind: 'builtin' | 'midi' = 'builtin';
  let selectedBuiltinId = BUILTIN_SONGS[0].id;
  let rafId = 0;
  let ambientSum = 0;
  let ambientCount = 0;
  let stablePitchSeen = false;
  let windowTuned = false;

  const songCards = Array.from(root.querySelectorAll<HTMLElement>('.song-card'));
  const midiInput = root.querySelector<HTMLInputElement>('.midi-input')!;
  const midiChosen = root.querySelector<HTMLElement>('.midi-chosen')!;
  const webcamToggle = root.querySelector<HTMLInputElement>('.t-webcam')!;
  const voiceToggle = root.querySelector<HTMLInputElement>('.t-voice')!;
  const micBtn = root.querySelector<HTMLButtonElement>('.btn-mic')!;
  const calibration = root.querySelector<HTMLElement>('.calibration')!;
  const calNote = root.querySelector<HTMLElement>('.cal-note')!;
  const calHz = root.querySelector<HTMLElement>('.cal-hz')!;
  const calClarityFill = root.querySelector<HTMLElement>('.cal-clarity-fill')!;
  const startBtn = root.querySelector<HTMLButtonElement>('.btn-start')!;

  function selectCard(card: HTMLElement): void {
    songCards.forEach((c) => c.classList.toggle('selected', c === card));
    selectedKind = card.dataset.kind as 'builtin' | 'midi';
    if (selectedKind === 'builtin') {
      selectedBuiltinId = card.dataset.id!;
    } else if (!midiFile) {
      midiInput.click();
    }
    updateStartEnabled();
  }

  songCards.forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('midi-input')) return;
      selectCard(card);
    });
  });

  midiInput.addEventListener('change', () => {
    const file = midiInput.files?.[0] ?? null;
    if (file) {
      midiFile = file;
      midiChosen.hidden = false;
      midiChosen.textContent = `🎵 ${file.name}`;
      updateStartEnabled();
    }
  });

  micBtn.addEventListener('click', async () => {
    micBtn.disabled = true;
    micBtn.textContent = 'Requesting…';
    try {
      await audio.start(); // AudioContext resume on user gesture
      mic = await initMic(audio.context, {
        minFreq: CONFIG.worklet.defaultMinFreq,
        maxFreq: CONFIG.worklet.maxFreq,
        hopSize: CONFIG.worklet.hopSize,
      });
      audio.connectMic(mic.source);
      pitch = new PitchEngine(mic);
      calibration.hidden = false;
      micBtn.textContent = '● Microphone live';
      micBtn.classList.add('live');
      calibrate();
    } catch (err) {
      micBtn.disabled = false;
      micBtn.textContent = 'Enable Microphone';
      calHz.textContent = `mic error: ${(err as Error).message}`;
    }
  });

  function calibrate(): void {
    const loop = () => {
      rafId = requestAnimationFrame(loop);
      if (!pitch) return;
      const raw = pitch.sampleRaw();
      // ambient RMS estimate when not voiced
      if (raw.freq === null) {
        ambientSum += raw.rms;
        ambientCount++;
        if (ambientCount === 60) {
          pitch.setAmbientRms(ambientSum / ambientCount);
        }
      }
      const clarity = raw.clarity;
      calClarityFill.style.width = `${Math.min(100, clarity * 100)}%`;
      if (raw.midiFloat !== null && clarity > CONFIG.clarityThreshold) {
        calNote.textContent = midiToNoteName(raw.midiFloat);
        calHz.textContent = `${Math.round(raw.freq!)} Hz · clarity ${clarity.toFixed(2)}`;
        if (!windowTuned) {
          // Narrow the worklet window to the singer's range (an octave below
          // their comfortable hum) — a shorter window means lower latency.
          windowTuned = true;
          pitch?.setExpectedLowMidi(raw.midiFloat - 12);
        }
        stablePitchSeen = true;
        updateStartEnabled();
      } else {
        calNote.textContent = '—';
      }
    };
    loop();
  }

  function updateStartEnabled(): void {
    const songOk = selectedKind === 'midi' ? midiFile !== null : true;
    startBtn.disabled = !(pitch !== null && stablePitchSeen && songOk);
  }

  startBtn.addEventListener('click', () => {
    if (!mic || !pitch) return;
    cancelAnimationFrame(rafId);
    onStart({
      songChoice:
        selectedKind === 'midi' && midiFile ? { midiFile } : { builtin: selectedBuiltinId },
      webcam: webcamToggle.checked,
      includeVoice: voiceToggle.checked,
      mic,
      pitch,
    });
  });

  return () => {
    cancelAnimationFrame(rafId);
    root.remove();
  };
}
