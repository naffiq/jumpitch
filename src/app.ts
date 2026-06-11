// Screen state machine: Start → (MidiSelect) → Playing → Results → Start.
// Owns the long-lived singletons (render core, audio engine) so the WebGL
// context and AudioContext persist across runs.

import type { RunStats, Song } from './types';
import { AudioEngine } from './audio/audioEngine';
import { getBuiltinSong } from './audio/builtinSongs';
import { parseMidiFile, buildSongFromMidi, type MidiInfo } from './audio/midiLoader';
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

  // Persisted across screens once acquired.
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
    this.toStart();
  }

  private clearScreen(): void {
    this.disposeScreen?.();
    this.disposeScreen = null;
  }

  private toStart(): void {
    this.clearScreen();
    this.disposeScreen = showStartScreen(this.uiRoot, this.audio, (result) =>
      this.onStartChosen(result),
    );
  }

  private async onStartChosen(result: StartResult): Promise<void> {
    this.pitch = result.pitch;
    this.wantWebcam = result.webcam;
    this.includeVoice = result.includeVoice;

    if ('builtin' in result.songChoice) {
      await this.beginRun(getBuiltinSong(result.songChoice.builtin));
    } else {
      try {
        const info = await parseMidiFile(result.songChoice.midiFile);
        this.toMidiSelect(info);
      } catch (err) {
        alert(`Could not read MIDI: ${(err as Error).message}`);
        this.toStart();
      }
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
      () => this.toStart(),
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
        const hint =
          name === 'NotReadableError' ? ' — close other apps using the camera' : '';
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
        this.toStart();
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
        this.toStart();
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
