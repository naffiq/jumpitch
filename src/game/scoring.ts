import { CONFIG } from '../config';
import type { Grade, RunStats } from '../types';

export class Scoring {
  score = 0;
  streak = 0;
  maxStreak = 0;
  health: number = CONFIG.maxHealth;
  perfects = 0;
  goods = 0;
  misses = 0;
  spikeHits = 0;

  constructor(public notesTotal: number) {}

  private multiplier(): number {
    return Math.min(4, 1 + this.streak * 0.1);
  }

  judge(grade: Grade): void {
    if (grade === 'miss') {
      this.misses++;
      this.streak = 0;
      return;
    }
    this.streak++;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    const base = grade === 'perfect' ? CONFIG.scorePerfect : CONFIG.scoreGood;
    this.score += Math.round(base * this.multiplier());
    if (grade === 'perfect') this.perfects++;
    else this.goods++;
  }

  spikeHit(): void {
    this.spikeHits++;
    this.score = Math.max(0, this.score - CONFIG.spikePenalty);
    this.streak = 0;
    this.health = Math.max(0, this.health - 1);
  }

  get dead(): boolean {
    return this.health <= 0;
  }

  get notesHit(): number {
    return this.perfects + this.goods;
  }

  get accuracy(): number {
    const judged = this.notesHit + this.misses;
    return judged === 0 ? 1 : this.notesHit / judged;
  }

  stats(failed: boolean): RunStats {
    return {
      score: this.score,
      maxStreak: this.maxStreak,
      notesHit: this.notesHit,
      notesTotal: this.notesTotal,
      perfects: this.perfects,
      goods: this.goods,
      spikeHits: this.spikeHits,
      accuracy: this.notesTotal === 0 ? 0 : this.notesHit / this.notesTotal,
      failed,
    };
  }
}

export function letterGrade(stats: RunStats): string {
  if (stats.failed) return 'F';
  const a = stats.accuracy;
  if (a >= 0.95) return 'S';
  if (a >= 0.85) return 'A';
  if (a >= 0.7) return 'B';
  if (a >= 0.5) return 'C';
  return 'D';
}
