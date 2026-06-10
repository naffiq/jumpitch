import { CONFIG } from '../config';

/**
 * Vertical motion of the sphere. While voiced, exponentially smooth toward the
 * sung pitch's height; while silent, fall under gravity to the floor. The
 * position is always clamped to the playing area [floor, ceil].
 */
export class Player {
  y = 0;
  private vy = 0;
  private floor: number;
  private ceil: number;

  constructor(floorY: number, ceilY: number, startY = 0) {
    this.floor = floorY;
    this.ceil = ceilY;
    this.y = this.clamp(startY);
  }

  private clamp(y: number): number {
    return Math.max(this.floor, Math.min(this.ceil, y));
  }

  update(dt: number, voiced: boolean, targetY: number | null): void {
    dt = Math.min(dt, CONFIG.maxDt);
    if (voiced && targetY !== null) {
      const prevY = this.y;
      const blend = 1 - Math.exp(-dt / CONFIG.smoothTau);
      this.y = this.clamp(this.y + (this.clamp(targetY) - this.y) * blend);
      this.vy = dt > 0 ? (this.y - prevY) / dt : 0; // keep handoff to gravity smooth
    } else {
      this.vy -= CONFIG.gravity * dt;
      this.y = this.clamp(this.y + this.vy * dt);
      if (this.y === this.floor || this.y === this.ceil) this.vy = 0;
    }
  }

  /** Knockback from a spike hit. */
  impulse(vy: number): void {
    this.vy = vy;
  }

  reset(startY: number): void {
    this.y = this.clamp(startY);
    this.vy = 0;
  }
}
