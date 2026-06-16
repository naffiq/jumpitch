// Main menu. Left: searchable grid of karaoke songs (neon covers, type badges,
// an animated selected ring). Right: a 3-step control column — STEP 1 mic check
// (enable → calibration → live pitch preview), STEP 2 capture options, STEP 3
// launch (readiness chip + Start + .txt / MIDI upload). The mic + pitch engine,
// once acquired, are handed back to the app so returning to the menu skips
// re-enabling. The visual language follows the Neopitch Menu design.

import { midiToNoteName } from '../../types';
import { CONFIG } from '../../config';
import type { AudioEngine } from '../../audio/audioEngine';
import { CATALOG, type SongSource } from '../../audio/catalog';
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

// Type badge palette — keyed by how the backing is delivered.
const TYPE_STYLE: Record<SongSource, { label: string; color: string; border: string }> = {
  video: { label: 'VIDEO', color: '#00f0ff', border: 'rgba(0,240,255,.5)' },
  midi: { label: 'MIDI', color: '#ff8c42', border: 'rgba(255,140,66,.5)' },
  karaoke: { label: 'KARAOKE', color: '#b7ff00', border: 'rgba(183,255,0,.5)' },
};

// Procedural cover gradients, picked deterministically per song when there's no
// artwork — so the grid stays colourful and stable across reloads.
const COVER_PAIRS: [string, string][] = [
  ['#ff2bd6', '#7b2bff'],
  ['#00f0ff', '#7b2bff'],
  ['#ff8c42', '#ff2bd6'],
  ['#7b2bff', '#00f0ff'],
  ['#ffd36b', '#ff2bd6'],
  ['#b7ff00', '#00f0ff'],
  ['#ff2bd6', '#ff8c42'],
  ['#00f0ff', '#b7ff00'],
  ['#2a6fdb', '#7b2bff'],
];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function letterOf(title: string): string {
  return (title.match(/[A-Za-z0-9]/)?.[0] ?? '♪').toUpperCase();
}

export function showStartScreen(
  parent: HTMLElement,
  deps: MenuDeps,
  onStart: (result: StartResult) => void,
  onPitchReady: (pitch: PitchEngine) => void,
): () => void {
  const root = document.createElement('div');
  root.className = 'screen menu-screen';

  const cards = CATALOG.map((s, i) => {
    const type = TYPE_STYLE[s.source];
    const [c0, c1] = COVER_PAIRS[hashOf(s.id) % COVER_PAIRS.length];
    const coverStyle = s.cover
      ? `background-image:url('${s.cover}')`
      : `background-image:radial-gradient(circle at 70% 24%,rgba(255,255,255,.32),transparent 46%),linear-gradient(150deg,${c0},${c1})`;
    const letter = s.cover ? '' : `<span class="song-letter">${letterOf(s.title)}</span>`;
    return `
      <button class="song-card ${i === 0 ? 'selected' : ''}" data-id="${s.id}"
              data-search="${`${s.title} ${s.meta}`.toLowerCase()}">
        <span class="card-ring" aria-hidden="true"></span>
        <span class="card-check" aria-hidden="true">✓</span>
        <span class="song-cover" style="${coverStyle}">
          ${letter}
          <span class="cover-shine"></span>
          <span class="cover-scrim"></span>
          <span class="song-badge" style="color:${type.color};border-color:${type.border}">${type.label}</span>
        </span>
        <span class="song-text">
          <span class="song-name">${s.title}</span>
          <span class="song-meta">${s.artist ?? ''}</span>
        </span>
      </button>`;
  }).join('');

  root.innerHTML = `
    <div class="menu-bg" aria-hidden="true">
      <div class="mb-stars"></div>
      <div class="mb-sun"></div>
      <div class="mb-sun-glow"></div>
      <div class="mb-horizon"></div>
      <div class="mb-grid"></div>
      <div class="mb-vignette"></div>
      <div class="mb-scan"></div>
    </div>
    <div class="menu-screen-inner">
    <div class="menu-main">
      <div class="menu-topline"></div>

      <div class="menu-header">
        <div class="brand-lockup">
          <div class="brand-row">
            <svg class="brand-mark" width="76" height="63" viewBox="0 0 120 100" aria-hidden="true">
              <defs>
                <linearGradient id="brandMk_b" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0" stop-color="#00f0ff"/>
                  <stop offset=".55" stop-color="#7b8cff"/>
                  <stop offset="1" stop-color="#ff2bd6"/>
                </linearGradient>
                <radialGradient id="brandMk_o" cx=".35" cy=".3" r=".85">
                  <stop offset="0" stop-color="#ffe2b6"/>
                  <stop offset=".4" stop-color="#ff9d4d"/>
                  <stop offset="1" stop-color="#e8531c"/>
                </radialGradient>
              </defs>
              <rect x="6" y="72" width="34" height="12" rx="6" fill="url(#brandMk_b)"/>
              <rect x="30" y="52" width="34" height="12" rx="6" fill="url(#brandMk_b)"/>
              <rect x="54" y="32" width="34" height="12" rx="6" fill="url(#brandMk_b)"/>
              <circle cx="94" cy="22" r="13" fill="url(#brandMk_o)"/>
              <circle cx="89.5" cy="18" r="4" fill="rgba(255,255,255,.65)"/>
            </svg>
            <h1 class="title-lockup">neopitch</h1>
          </div>
          <div class="menu-tagline">
            <span class="tag-jp">カラオケ</span>
            <span class="tag-dot"></span>
            <span class="tag-text">SING INTO THE GRID</span>
          </div>
        </div>
        <div class="track-count">${CATALOG.length} TRACKS</div>
      </div>

      <div class="search-wrap">
        <span class="search-icon">⌕</span>
        <input class="song-search" type="search" placeholder="Search songs…" aria-label="Search songs">
      </div>

      <div class="section-label"><span class="section-tick"></span>CHOOSE YOUR ANTHEM</div>

      <div class="song-grid">${cards}</div>
      <div class="song-empty" hidden>
        <div class="empty-icon">🎤</div>
        <div class="empty-title">NO TRACKS FOUND</div>
        <div class="empty-sub"></div>
      </div>
    </div>

    <aside class="menu-side">
      <!-- STEP 1 · MIC -->
      <div class="step-panel mic-area">
        <div class="menu-topline"></div>
        <div class="step-head"><span class="step-num step-cyan">STEP 1</span><span class="step-rule"></span><span class="step-name">MIC CHECK</span></div>

        <button class="btn-mic">🎙 Enable Microphone</button>
        <p class="mic-privacy">We never store audio — pitch is read live in your browser.</p>

        <div class="calibration" hidden>
          <div class="cal-caption">Calibrating · hum a comfortable note</div>
          <div class="cal-note">—</div>
          <div class="cal-hz">listening…</div>
          <div class="cal-row">
            <span class="cal-row-label">CLARITY</span>
            <div class="cal-clarity"><div class="cal-clarity-fill"></div></div>
            <span class="cal-clarity-pct">0%</span>
          </div>
          <p class="cal-hint">🎧 Headphones recommended to avoid echo</p>
        </div>

        <div class="pitch-preview" hidden>
          <div class="pp-note">—</div>
          <div class="pp-body">
            <div class="pp-label-row"><span class="pp-dot"></span><span class="pp-label">mic live · your pitch</span></div>
            <div class="pp-bar"><div class="pp-fill"></div></div>
          </div>
        </div>
      </div>

      <!-- STEP 2 · OPTIONS -->
      <div class="step-panel step-magenta-panel">
        <div class="step-head"><span class="step-num step-magenta">STEP 2</span><span class="step-rule"></span><span class="step-name">OPTIONS</span></div>
        <div class="toggles">
          <label class="toggle">
            <input type="checkbox" class="t-webcam" checked>
            <span class="toggle-box toggle-magenta"></span>
            <span class="toggle-text">
              <span class="toggle-title">Webcam bubble</span>
              <span class="toggle-sub">Show a mirrored selfie ring while you sing</span>
            </span>
          </label>
          <label class="toggle">
            <input type="checkbox" class="t-voice" checked>
            <span class="toggle-box toggle-lime"></span>
            <span class="toggle-text">
              <span class="toggle-title">Record my voice</span>
              <span class="toggle-sub">Save a replay you can download after</span>
            </span>
          </label>
        </div>
      </div>

      <!-- STEP 3 · LAUNCH -->
      <div class="step-panel step-orange-panel">
        <div class="step-head"><span class="step-num step-orange">STEP 3</span><span class="step-rule"></span><span class="step-name">LAUNCH</span></div>

        <div class="readiness">
          <span class="mic-chip"><span class="chip-icon">○</span> Mic</span>
          <span class="chip-dot">·</span>
          <span class="song-chip"><span class="chip-icon">○</span> <span class="chip-text">No track</span></span>
        </div>

        <button class="btn-start" disabled>🔒 START ▶</button>
        <div class="start-hint"></div>

        <div class="upload-row">
          <label class="upload-card" data-kind="ultrastar">＋ .txt chart
            <input type="file" class="txt-input" accept=".txt" hidden>
          </label>
          <label class="upload-card upload-midi" data-kind="midi">＋ MIDI
            <input type="file" class="midi-input" accept=".mid,.midi" hidden>
          </label>
        </div>
        <div class="midi-chosen" hidden></div>
      </div>
    </aside>
    </div>
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
  const grid = root.querySelector<HTMLElement>('.song-grid')!;
  const empty = root.querySelector<HTMLElement>('.song-empty')!;
  const emptySub = empty.querySelector<HTMLElement>('.empty-sub')!;
  const uploadCards = Array.from(root.querySelectorAll<HTMLElement>('.upload-card'));
  const midiInput = root.querySelector<HTMLInputElement>('.midi-input')!;
  const txtInput = root.querySelector<HTMLInputElement>('.txt-input')!;
  const chosen = root.querySelector<HTMLElement>('.midi-chosen')!;
  const webcamToggle = root.querySelector<HTMLInputElement>('.t-webcam')!;
  const voiceToggle = root.querySelector<HTMLInputElement>('.t-voice')!;
  const startBtn = root.querySelector<HTMLButtonElement>('.btn-start')!;
  const startHint = root.querySelector<HTMLElement>('.start-hint')!;
  const micBtn = root.querySelector<HTMLButtonElement>('.btn-mic')!;
  const micPrivacy = root.querySelector<HTMLElement>('.mic-privacy')!;
  const calibration = root.querySelector<HTMLElement>('.calibration')!;
  const calNote = root.querySelector<HTMLElement>('.cal-note')!;
  const calHz = root.querySelector<HTMLElement>('.cal-hz')!;
  const calClarityFill = root.querySelector<HTMLElement>('.cal-clarity-fill')!;
  const calClarityPct = root.querySelector<HTMLElement>('.cal-clarity-pct')!;
  const preview = root.querySelector<HTMLElement>('.pitch-preview')!;
  const ppNote = root.querySelector<HTMLElement>('.pp-note')!;
  const ppFill = root.querySelector<HTMLElement>('.pp-fill')!;
  const micChip = root.querySelector<HTMLElement>('.mic-chip')!;
  const songChip = root.querySelector<HTMLElement>('.song-chip')!;
  const songChipText = songChip.querySelector<HTMLElement>('.chip-text')!;

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
    chosen.innerHTML = `📄 <span class="chosen-name">${file.name}</span><span class="chosen-clear">✕</span>`;
    wireClear();
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
    chosen.innerHTML = `📄 <span class="chosen-name">${file.name}</span><span class="chosen-clear">✕</span>`;
    wireClear();
    updateStartEnabled();
  });

  function wireClear(): void {
    chosen.querySelector<HTMLElement>('.chosen-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      midiFile = null;
      ultrastarText = null;
      ultrastarName = '';
      midiInput.value = '';
      txtInput.value = '';
      chosen.hidden = true;
      clearSelection();
      selectedKind = 'catalog';
      songCards.find((c) => c.dataset.id === selectedCatalogId)?.classList.add('selected');
      updateStartEnabled();
    });
  }

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let any = false;
    for (const card of songCards) {
      const hit = q === '' || (card.dataset.search ?? '').includes(q);
      card.hidden = !hit;
      any = any || hit;
    }
    grid.hidden = !any;
    empty.hidden = any;
    if (!any) emptySub.textContent = `Nothing matches “${search.value.trim()}”. Try another title or artist.`;
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
      micPrivacy.hidden = true;
      calibration.hidden = false;
      startSampling();
    } catch (err) {
      micBtn.disabled = false;
      micBtn.textContent = '🎙 Enable Microphone';
      calibration.hidden = false;
      calNote.textContent = '⚠';
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
        const pct = Math.min(100, Math.round(clarity * 100));
        calClarityFill.style.width = `${pct}%`;
        calClarityPct.textContent = `${pct}%`;
        calNote.textContent = noteName;
        if (raw.midiFloat !== null && clarity > CONFIG.clarityThreshold) {
          calHz.textContent = `${Math.round(raw.freq!)} Hz`;
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
  function selectedTitle(): string {
    if (selectedKind === 'midi') return midiFile?.name ?? '';
    if (selectedKind === 'ultrastar') return ultrastarName;
    return CATALOG.find((s) => s.id === selectedCatalogId)?.title ?? '';
  }

  function songOk(): boolean {
    return selectedKind === 'midi'
      ? midiFile !== null
      : selectedKind === 'ultrastar'
        ? ultrastarText !== null
        : selectedCatalogId !== '';
  }

  function updateStartEnabled(): void {
    const ready = live && songOk();
    startBtn.disabled = !ready;
    startBtn.textContent = ready ? 'START ▶' : '🔒 START ▶';

    micChip.classList.toggle('chip-on', live);
    micChip.querySelector('.chip-icon')!.textContent = live ? '✓' : '○';
    const song = songOk();
    songChip.classList.toggle('chip-on', song);
    songChip.querySelector('.chip-icon')!.textContent = song ? '✓' : '○';
    songChipText.textContent = song ? selectedTitle() : 'No track';

    if (ready) {
      startHint.hidden = true;
    } else {
      startHint.hidden = false;
      startHint.textContent = !live && !song
        ? 'Enable your mic and pick a track'
        : !live
          ? 'Enable your mic to begin'
          : 'Pick a track to sing';
    }
  }

  function currentChoice(): SongChoice {
    if (selectedKind === 'midi' && midiFile) return { midiFile };
    if (selectedKind === 'ultrastar' && ultrastarText) return { ultrastarText, name: ultrastarName };
    return { catalog: selectedCatalogId };
  }

  function showLaunchOverlay(songName: string): void {
    const overlay = document.createElement('div');
    overlay.className = 'launch-overlay';
    overlay.innerHTML = `
      <div class="launch-title">GET READY</div>
      <div class="launch-sub">Loading ${songName} ▶</div>
      <div class="launch-bar"><div class="launch-bar-fill"></div></div>`;
    root.appendChild(overlay);
  }

  startBtn.addEventListener('click', () => {
    if (startBtn.disabled) return;
    cancelAnimationFrame(rafId);
    showLaunchOverlay(selectedTitle());
    onStart({
      songChoice: currentChoice(),
      webcam: webcamToggle.checked,
      includeVoice: voiceToggle.checked,
    });
  });

  // If the mic is already live (returning to the menu), show the preview now.
  if (live) {
    micBtn.hidden = true;
    micPrivacy.hidden = true;
    preview.hidden = false;
    startSampling();
  }
  updateStartEnabled();

  return () => {
    cancelAnimationFrame(rafId);
    root.remove();
  };
}
