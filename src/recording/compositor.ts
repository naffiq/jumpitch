// 2D recording canvas. The WebGL frame must be copied in the SAME task right
// after composer.render(), or the drawing buffer may already be cleared and
// the recording comes out black. CSS overlays never reach the file — the
// webcam PiP is drawn here.

import { CONFIG } from '../config';

export class Compositor {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = CONFIG.recordWidth;
    this.canvas.height = CONFIG.recordHeight;
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
  }

  drawFrame(webglCanvas: HTMLCanvasElement, webcam: HTMLVideoElement | null): void {
    const { width, height } = this.canvas;
    this.ctx.drawImage(webglCanvas, 0, 0, width, height);

    if (webcam && webcam.readyState >= 2) {
      const r = 84;
      const cx = 24 + r;
      const cy = height - 24 - r;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.clip();
      // cover-fit and mirror the webcam into the circle
      const vw = webcam.videoWidth;
      const vh = webcam.videoHeight;
      const scale = Math.max((r * 2) / vw, (r * 2) / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      this.ctx.translate(cx + dw / 2, cy - dh / 2);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(webcam, 0, 0, dw, dh);
      this.ctx.restore();
      // neon ring
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = '#ff2bd6';
      this.ctx.shadowColor = '#ff2bd6';
      this.ctx.shadowBlur = 12;
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }
  }
}
