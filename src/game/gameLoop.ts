// One Game instance per run. Frame order matters:
// input → physics → judging → world updates → render → composite (same task!)

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { RunStats, Song } from '../types';
import { AudioEngine } from '../audio/audioEngine';
import { LeadSynth } from '../audio/leadSynth';
import { DemoLead, type DemoNote } from '../audio/demoLead';
import { PitchEngine } from '../pitch/pitchEngine';
import { buildLevel } from './level';
import { floorY, midiToY, timeToZ } from './mapping';
import { Player } from './player';
import { HitJudge } from './hitDetection';
import { Scoring } from './scoring';
import { createScene, createCamera, disposeScene, type RenderCore } from '../render/sceneSetup';
import { CameraRig } from '../render/cameraRig';
import { PostFx } from '../render/postfx';
import { Platforms } from '../render/platforms';
import { Spikes } from '../render/spikes';
import { createSky } from '../render/vaporwave/sky';
import { Sun } from '../render/vaporwave/sun';
import { GridFloor } from '../render/vaporwave/grid';
import { Palms } from '../render/vaporwave/palms';
import { Compositor } from '../recording/compositor';
import { RunRecorder, downloadRecording } from '../recording/recorder';
import { Hud } from '../ui/hud';
import { KaraokeBar } from '../ui/karaokeBar';
import { YouTubePlayer } from '../ui/youtubePlayer';
import { showPauseMenu } from '../ui/screens/pauseMenu';

export interface GameOptions {
  core: RenderCore;
  audio: AudioEngine;
  pitch: PitchEngine;
  song: Song;
  uiParent: HTMLElement;
  webcamVideo: HTMLVideoElement | null;
  includeVoiceInRecording: boolean;
  onFinish: (stats: RunStats, recording: Blob) => void;
  onRestart: () => void; // pause → restart the same song (Game disposes itself first)
  onExitToMenu: () => void; // pause → back to the start screen
}

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private rig: CameraRig;
  private postfx: PostFx;
  private platforms: Platforms;
  private spikes: Spikes;
  private sky: THREE.Mesh;
  private sun: Sun;
  private grid: GridFloor;
  private palms: Palms;
  private sphere: THREE.Mesh;
  private player: Player;
  private judge: HitJudge;
  private scoring: Scoring;
  private lead: LeadSynth;
  private demoLead: DemoLead | null = null;
  private hud: Hud;
  private karaoke: KaraokeBar | null = null;
  private compositor = new Compositor();
  private recorder = new RunRecorder();
  private webcamPip: HTMLVideoElement | null = null;

  // Backing-video mode (UltraStar #VIDEO): the YouTube video is the audio source
  // and the master clock. The run waits for the user to press play.
  private yt: YouTubePlayer | null = null;
  private videoMode = false;
  private videoGap = 0;
  private videoPlaying = false;
  private started = false;
  private waitHintEl: HTMLElement | null = null;
  private skipBtn: HTMLButtonElement | null = null;

  private rafId = 0;
  private lastTime = 0;
  private hudAccum = 0;
  private spikeCooldown = 0;
  private ending = false;
  private paused = false;
  private pauseMenuDispose: (() => void) | null = null;
  private floor: number;
  private ceil: number;
  private lastSphereZ = 0;
  private onResize = () => this.handleResize();
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.togglePause();
    }
  };

  constructor(private opts: GameOptions) {
    const { core, song } = opts;
    this.scene = createScene();
    this.camera = createCamera();
    this.rig = new CameraRig(this.camera);
    this.postfx = new PostFx(core.renderer, this.scene, this.camera);

    const level = buildLevel(song);
    this.platforms = new Platforms(this.scene, level.platforms);
    this.spikes = new Spikes(this.scene, level.spikeRows);
    this.sky = createSky(this.scene);
    this.sun = new Sun(this.scene);
    this.floor = floorY(song.registerMin, song.registerCenter);
    this.ceil = midiToY(song.registerMax, song.registerCenter) + CONFIG.ceilingMarginSemitones * CONFIG.semitoneHeight;
    this.grid = new GridFloor(this.scene, this.floor);
    this.palms = new Palms(this.scene, this.floor);

    this.sphere = new THREE.Mesh(
      new THREE.SphereGeometry(CONFIG.sphereRadius, 32, 24),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(CONFIG.colors.sphere).multiplyScalar(1.5),
        toneMapped: false,
      }),
    );
    this.scene.add(this.sphere);

    const startY = midiToY(song.lead[0]?.midi ?? song.registerCenter, song.registerCenter);
    this.player = new Player(this.floor, this.ceil, startY);
    this.lead = new LeadSynth();
    this.judge = new HitJudge(
      song,
      this.lead,
      (_note, _i, grade) => {
        this.scoring.judge(grade);
        this.hud.flashJudgement(grade);
        this.hud.updateStats(this.scoring);
      },
      (i) => this.platforms.hit(i),
    );
    this.scoring = new Scoring(this.judge.responseCount); // demo notes don't count
    this.hud = new Hud(opts.uiParent, true, () => this.togglePause());
    this.hud.pitchMeter.setRange(song.registerMin, song.registerMax);
    if (song.lyricLines?.length) this.karaoke = new KaraokeBar(opts.uiParent, song.lyricLines);
  }

  start(): void {
    const { audio, pitch, song } = this.opts;
    pitch.setRegister(song.registerCenter);
    pitch.reset();
    audio.loadSong(song, () => this.endRun(false));
    audio.setMicInRecording(this.opts.includeVoiceInRecording);
    this.rig.snap(this.player.y, 0);

    // Schedule the teacher's "call" notes (if this is a call-and-response song).
    const demoNotes: DemoNote[] = [];
    song.lead.forEach((note, index) => {
      if (note.demo) demoNotes.push({ note, index });
    });
    if (demoNotes.length > 0) {
      this.demoLead = new DemoLead(this.lead, demoNotes, (i) => this.platforms.hit(i));
    }

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);

    // Video and MIDI songs carry their own melody in the real backing, so mute
    // the synth pitch-reference (it would clash / double the tune).
    if (song.video || song.midiUrl) this.lead.mute();

    if (song.video) {
      // Sing to the real track: show the video in the corner, render a frozen
      // first frame, and wait for the user to press play.
      this.videoMode = true;
      this.videoGap = song.video.gap;
      this.renderFrozenFrame();
      this.showWaitHint();
      if (this.videoGap > 0.25) this.createSkipButton();
      this.yt = new YouTubePlayer(this.opts.uiParent, {
        videoId: song.video.youtubeId,
        onPlay: () => this.onVideoPlay(),
        onPause: () => this.onVideoPause(),
        onEnded: () => void this.endRun(false),
      });
      return;
    }

    this.beginPlayback();
  }

  /** Start the render loop + recording (and, for synth songs, the transport). */
  private beginPlayback(): void {
    const { audio } = this.opts;
    this.started = true;
    this.showWebcamPreview();
    this.recorder.start(this.compositor.canvas, audio.recordDest.stream.getAudioTracks()[0]);
    audio.ensureRunning(); // guard against a suspended context (so pitch input flows)
    if (!this.videoMode) audio.play();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** The master game clock: the video time in video mode, else the transport. */
  private clock(): number {
    if (this.videoMode) return Math.max(0, (this.yt?.currentTime ?? 0) - this.videoGap);
    return this.opts.audio.time;
  }

  private onVideoPlay(): void {
    if (this.ending) return;
    this.hideWaitHint();
    if (!this.started) {
      this.yt?.dock(); // slide the video from center to the corner as the game begins
      this.videoPlaying = true;
      this.beginPlayback();
      return;
    }
    if (this.videoPlaying) return;
    this.videoPlaying = true;
    this.recorder.resume();
    this.lastTime = performance.now();
  }

  private onVideoPause(): void {
    if (this.ending || !this.started || !this.videoPlaying) return;
    this.videoPlaying = false;
    this.recorder.pause();
    this.lead.releaseAll();
    // The frame loop freezes itself (and stops accruing dt) while !videoPlaying.
  }

  private renderFrozenFrame(): void {
    this.sphere.position.set(0, this.player.y, timeToZ(0));
    this.rig.snap(this.player.y, 0);
    this.postfx.render(0);
  }

  private showWaitHint(): void {
    this.waitHintEl = document.createElement('div');
    this.waitHintEl.className = 'yt-wait-hint';
    this.waitHintEl.textContent = '▶ Press play on the video to begin';
    this.opts.uiParent.appendChild(this.waitHintEl);
  }

  private hideWaitHint(): void {
    this.waitHintEl?.remove();
    this.waitHintEl = null;
  }

  private createSkipButton(): void {
    this.skipBtn = document.createElement('button');
    this.skipBtn.className = 'yt-skip';
    this.skipBtn.textContent = 'Skip intro ⏭';
    this.skipBtn.hidden = true;
    this.skipBtn.addEventListener('click', () => {
      this.yt?.seekTo(this.videoGap); // jump to the song start (t = 0)
      if (this.skipBtn) this.skipBtn.hidden = true;
    });
    this.opts.uiParent.appendChild(this.skipBtn);
  }

  togglePause(): void {
    if (this.ending) return;
    if (this.paused) this.resumeGame();
    else this.pauseGame();
  }

  private pauseGame(): void {
    if (this.paused || this.ending) return;
    this.paused = true;
    if (this.videoMode) {
      this.yt?.pause(); // → onVideoPause freezes the loop + pauses the recorder
    } else {
      cancelAnimationFrame(this.rafId);
      this.opts.audio.pause();
      this.lead.releaseAll(); // stop the sustaining pitch-reference note (it would drone)
      this.recorder.pause();
    }
    this.pauseMenuDispose = showPauseMenu(this.opts.uiParent, {
      hasRecording: this.recorder.active,
      onContinue: () => this.resumeGame(),
      onRestart: (save) => void this.exitTo('restart', save),
      onMenu: (save) => void this.exitTo('menu', save),
    });
  }

  private resumeGame(): void {
    if (!this.paused || this.ending) return;
    this.paused = false;
    this.pauseMenuDispose?.();
    this.pauseMenuDispose = null;
    if (this.videoMode) {
      this.yt?.play(); // → onVideoPlay resumes the loop + recorder
      return;
    }
    this.opts.audio.resume();
    this.recorder.resume();
    this.lastTime = performance.now(); // avoid a dt spike on the first resumed frame
    this.rafId = requestAnimationFrame(this.frame);
  }

  /** Leave a paused run, optionally saving the recording first. */
  private async exitTo(action: 'restart' | 'menu', save: boolean): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    this.pauseMenuDispose?.();
    this.pauseMenuDispose = null;
    const blob = await this.recorder.stop();
    if (save) downloadRecording(blob);
    this.dispose();
    if (action === 'restart') this.opts.onRestart();
    else this.opts.onExitToMenu();
  }

  /** Mount the live webcam feed as an on-screen picture-in-picture bubble. */
  private showWebcamPreview(): void {
    const video = this.opts.webcamVideo;
    if (!video) return;
    video.classList.add('webcam-pip');
    video.muted = true;
    this.opts.uiParent.appendChild(video);
    void video.play().catch(() => {});
    this.webcamPip = video;
  }

  private frame = (now: number) => {
    if (this.ending) return;
    this.rafId = requestAnimationFrame(this.frame);

    // Video mode: freeze (and don't accrue dt) whenever the video isn't playing.
    if (this.videoMode && !this.videoPlaying) {
      this.lastTime = now;
      return;
    }

    const dt = Math.min((now - this.lastTime) / 1000, CONFIG.maxDt);
    this.lastTime = now;

    const { pitch, song } = this.opts;
    const t = this.clock(); // the single game clock (video time, or transport)

    if (this.videoMode) {
      if (t >= song.duration) {
        this.endRun(false);
        return;
      }
      if (this.skipBtn) {
        // Offer the skip while the video is still in its pre-song intro.
        this.skipBtn.hidden = (this.yt?.currentTime ?? 0) >= this.videoGap - 0.25;
      }
    }

    // 1. input
    const sample = pitch.sample();
    const targetY =
      sample.foldedMidi !== null ? midiToY(sample.foldedMidi, song.registerCenter) : null;

    // 2. physics
    this.player.update(dt, sample.voiced, targetY);
    const z = timeToZ(t);
    this.sphere.position.set(0, this.player.y, z);

    // 3. judging (latency-compensated time)
    const judgedT = t - CONFIG.inputLatencyComp;
    this.judge.update(judgedT, dt, sample.voiced, this.player.y);

    // 4. spikes (sweep the Z crossed this frame to avoid tunneling)
    this.spikeCooldown -= dt;
    if (this.spikeCooldown <= 0 && this.spikes.collides(this.player.y, z, this.lastSphereZ)) {
      this.spikeCooldown = CONFIG.spikeCooldown;
      this.scoring.spikeHit();
      this.postfx.triggerGlitch();
      this.player.impulse(-9);
      this.hud.updateStats(this.scoring);
      if (this.scoring.dead) {
        this.endRun(true);
        return;
      }
    }

    // 5. world updates
    this.lastSphereZ = z;
    this.platforms.update(dt);
    this.rig.update(dt, this.player.y, z);
    this.sky.position.copy(this.camera.position); // keep the dome around the camera
    this.sun.update(this.camera.position);
    this.grid.update(this.camera);
    this.palms.update(this.camera.position.z);

    // 6. render + composite in the same task (recording would be black otherwise)
    this.postfx.render(dt);
    this.compositor.drawFrame(this.opts.core.canvas, this.opts.webcamVideo);

    // 7. HUD (stats throttled; pitch meter every frame)
    this.hud.tick(dt);
    this.karaoke?.tick(t); // lyrics track the audible clock, not judgedT
    const target = this.judge.currentTarget(judgedT);
    const inTol =
      target !== null &&
      sample.foldedMidi !== null &&
      Math.abs(sample.foldedMidi - target.midi) <= CONFIG.hitToleranceSemitones;
    this.hud.pitchMeter.update(sample.foldedMidi, target?.midi ?? null, inTol);
    // Coaching cue for call-and-response songs (null target → no cue shown).
    this.hud.setPrompt(target ? (target.demo ? 'listen' : 'sing') : null);
    this.hudAccum += dt;
    if (this.hudAccum > 0.1) {
      this.hudAccum = 0;
      this.hud.updateStats(this.scoring);
    }
  };

  private async endRun(failed: boolean): Promise<void> {
    if (this.ending) return;
    this.ending = true;
    cancelAnimationFrame(this.rafId);
    this.judge.finish();
    const stats = this.scoring.stats(failed);
    const blob = await this.recorder.stop();
    this.dispose();
    this.opts.onFinish(stats, blob);
  }

  /** Player quits mid-run. */
  abort(): void {
    if (this.ending) return;
    this.ending = true;
    cancelAnimationFrame(this.rafId);
    void this.recorder.stop();
    this.dispose();
  }

  private handleResize(): void {
    const { renderer } = this.opts.core;
    renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(window.innerWidth, window.innerHeight);
  }

  private dispose(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    this.pauseMenuDispose?.();
    this.pauseMenuDispose = null;
    this.opts.audio.unloadSong();
    this.opts.audio.setMicInRecording(false);
    this.demoLead?.dispose();
    if (this.webcamPip) {
      this.webcamPip.classList.remove('webcam-pip');
      this.webcamPip.remove(); // detach from DOM; the stream stays alive for replays
      this.webcamPip = null;
    }
    this.lead.dispose();
    this.hud.dispose();
    this.karaoke?.dispose();
    this.yt?.dispose();
    this.hideWaitHint();
    this.skipBtn?.remove();
    this.skipBtn = null;
    this.postfx.dispose();
    disposeScene(this.scene);
  }
}
