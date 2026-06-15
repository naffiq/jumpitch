// Screen state machine: Menu → (MidiSelect) → Playing → Results → Menu.
// Owns the long-lived singletons (render core, audio engine) so the WebGL
// context and AudioContext persist across runs. The mic + pitch engine are
// acquired in the menu and kept for the whole session.

import type { RunStats, Song } from './types';
import { AudioEngine } from './audio/audioEngine';
import { getBuiltinSong } from './audio/builtinSongs';
import { getCatalogSong } from './audio/catalog';
import { parseUltraStar } from './audio/ultrastar';
import { parseMidiFile, buildSongFromMidi, loadMidiBacking, type MidiInfo } from './audio/midiLoader';
import { PitchEngine } from './pitch/pitchEngine';
import { createRenderCore, type RenderCore } from './render/sceneSetup';
import { Game } from './game/gameLoop';
import { showStartScreen, type StartResult } from './ui/screens/startScreen';
import { showMidiSelect } from './ui/screens/midiSelect';
import { showResultsScreen } from './ui/screens/resultsScreen';
import { initWebcam, type Webcam } from './ui/webcam';

export class App {
  private core: RenderCore;
  private audio = new AudioEngine();
  private uiRoot: HTMLElement;
  private disposeScreen: (() => void) | null = null;

  // Acquired in the menu's mic step, persisted across screens.
  private pitch: PitchEngine | null = null;
  private webcam: Webcam | null = null;
  private wantWebcam = false;
  private includeVoice = false;
  private game: Game | null = null;

  constructor(container: HTMLElement, uiRoot: HTMLElement) {
    this.core = createRenderCore(container);
    this.uiRoot = uiRoot;
  }

  start(): void {
    this.toMenu();
  }

  private clearScreen(): void {
    this.disposeScreen?.();
    this.disposeScreen = null;
  }

  private toMenu(): void {
    this.clearScreen();
    this.disposeScreen = showStartScreen(
      this.uiRoot,
      { audio: this.audio, pitch: this.pitch },
      (result) => this.onStartChosen(result),
      (pitch) => {
        this.pitch = pitch;
      },
    );
  }

  private async onStartChosen(result: StartResult): Promise<void> {
    this.wantWebcam = result.webcam;
    this.includeVoice = result.includeVoice;

    const choice = result.songChoice;
    if ('catalog' in choice) {
      const song = getCatalogSong(choice.catalog);
      await this.attachMidiBacking(song);
      await this.beginRun(song);
    } else if ('builtin' in choice) {
      await this.beginRun(getBuiltinSong(choice.builtin));
    } else if ('ultrastarText' in choice) {
      try {
        await this.beginRun(parseUltraStar(choice.ultrastarText));
      } catch (err) {
        this.showToast(`Could not read ${choice.name}: ${(err as Error).message}`);
        this.toMenu();
      }
    } else {
      try {
        const info = await parseMidiFile(choice.midiFile);
        this.toMidiSelect(info);
      } catch (err) {
        this.showToast(`Could not read MIDI: ${(err as Error).message}`);
        this.toMenu();
      }
    }
  }

  /** Replace a #MIDI song's fallback synth backing with the real arrangement. */
  private async attachMidiBacking(song: Song): Promise<void> {
    if (!song.midiUrl) return;
    try {
      const { backing, bpm } = await loadMidiBacking(song.midiUrl);
      if (backing.length > 0) {
        song.backing = backing;
        song.bpm = bpm;
      }
    } catch (err) {
      // Non-blocking — the synth backing baked in at parse stays as a fallback.
      this.showToast(`MIDI backing failed (${(err as Error).message}); using synth.`);
    }
  }

  private toMidiSelect(info: MidiInfo): void {
    this.clearScreen();
    this.disposeScreen = showMidiSelect(
      this.uiRoot,
      info,
      (leadIndex) => {
        void this.beginRun(buildSongFromMidi(info, leadIndex));
      },
      () => this.toMenu(),
    );
  }

  private async beginRun(song: Song): Promise<void> {
    this.clearScreen();
    if (this.wantWebcam && !this.webcam) {
      try {
        this.webcam = await initWebcam();
      } catch (err) {
        // Permission denied / camera busy — proceed without it. A non-blocking
        // toast (NOT alert(), which would suspend the AudioContext and freeze
        // pitch input) tells the player.
        console.warn('[jumpitch] webcam unavailable:', err);
        const name = (err as Error).name;
        const hint = name === 'NotReadableError' ? ' — close other apps using the camera' : '';
        this.showToast(`Webcam off (${name})${hint}. Playing without it.`);
        this.webcam = null;
      }
    }
    if (!this.pitch) return;

    this.game = new Game({
      core: this.core,
      audio: this.audio,
      pitch: this.pitch,
      song,
      uiParent: this.uiRoot,
      webcamVideo: this.wantWebcam ? (this.webcam?.video ?? null) : null,
      includeVoiceInRecording: this.includeVoice,
      onFinish: (stats, blob) => this.onRunFinished(song, stats, blob),
      onRestart: () => {
        this.game = null;
        void this.beginRun(song);
      },
      onExitToMenu: () => {
        this.game = null;
        this.stopWebcam();
        this.toMenu();
      },
    });
    this.game.start();
  }

  private onRunFinished(song: Song, stats: RunStats, blob: Blob): void {
    this.game = null;
    this.disposeScreen = showResultsScreen(
      this.uiRoot,
      stats,
      blob,
      () => void this.beginRun(song),
      () => {
        this.stopWebcam();
        this.toMenu();
      },
    );
  }

  private stopWebcam(): void {
    this.webcam?.stop();
    this.webcam = null;
  }

  /** Non-blocking transient notice (never use alert() — it stalls the audio thread). */
  private showToast(message: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    this.uiRoot.appendChild(el);
    setTimeout(() => el.classList.add('toast-out'), 3500);
    setTimeout(() => el.remove(), 4100);
  }
}
