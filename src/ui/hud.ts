import { CONFIG } from '../config';
import type { Grade } from '../types';
import type { Scoring } from '../game/scoring';
import { PitchMeter } from './pitchMeter';

export class Hud {
  private root: HTMLElement;
  private scoreEl: HTMLElement;
  private streakEl: HTMLElement;
  private accEl: HTMLElement;
  private healthEl: HTMLElement;
  private judgementEl: HTMLElement;
  private promptEl!: HTMLElement;
  private judgementTimer = 0;
  private promptMode: 'listen' | 'sing' | null = null;
  readonly pitchMeter = new PitchMeter();

  constructor(parent: HTMLElement, recording: boolean) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-stat"><span class="hud-label">SCORE</span><span class="hud-score">0</span></div>
        <div class="hud-stat"><span class="hud-label">STREAK</span><span class="hud-streak">×0</span></div>
        <div class="hud-stat"><span class="hud-label">ACC</span><span class="hud-acc">100%</span></div>
        <div class="hud-health"></div>
        ${recording ? '<div class="hud-rec"><span class="rec-dot"></span>REC</div>' : ''}
      </div>
      <div class="hud-prompt"></div>
      <div class="hud-judgement"></div>
    `;
    this.scoreEl = this.root.querySelector('.hud-score')!;
    this.streakEl = this.root.querySelector('.hud-streak')!;
    this.accEl = this.root.querySelector('.hud-acc')!;
    this.healthEl = this.root.querySelector('.hud-health')!;
    this.judgementEl = this.root.querySelector('.hud-judgement')!;
    this.promptEl = this.root.querySelector('.hud-prompt')!;
    this.root.appendChild(this.pitchMeter.el);
    parent.appendChild(this.root);
    this.setHealth(CONFIG.maxHealth);
  }

  updateStats(scoring: Scoring): void {
    this.scoreEl.textContent = String(scoring.score);
    this.streakEl.textContent = `×${scoring.streak}`;
    this.accEl.textContent = `${Math.round(scoring.accuracy * 100)}%`;
    this.setHealth(scoring.health);
  }

  private setHealth(health: number): void {
    this.healthEl.innerHTML = Array.from(
      { length: CONFIG.maxHealth },
      (_, i) => `<span class="pip ${i < health ? 'full' : 'empty'}"></span>`,
    ).join('');
  }

  /** Call-and-response coaching cue. Pass null for free-play songs. */
  setPrompt(mode: 'listen' | 'sing' | null): void {
    if (mode === this.promptMode) return;
    this.promptMode = mode;
    if (mode === null) {
      this.promptEl.classList.remove('show');
      return;
    }
    this.promptEl.textContent = mode === 'listen' ? '👂 LISTEN' : '🎤 YOUR TURN';
    this.promptEl.className = `hud-prompt show prompt-${mode}`;
  }

  flashJudgement(grade: Grade): void {
    const text = grade === 'perfect' ? 'PERFECT' : grade === 'good' ? 'GOOD' : 'MISS';
    this.judgementEl.textContent = text;
    this.judgementEl.className = `hud-judgement show grade-${grade}`;
    this.judgementTimer = 0.7;
  }

  tick(dt: number): void {
    if (this.judgementTimer > 0) {
      this.judgementTimer -= dt;
      if (this.judgementTimer <= 0) this.judgementEl.classList.remove('show');
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
