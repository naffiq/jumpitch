import { CONFIG } from '../config';

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export function pickMimeType(): string {
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return '';
}

export class RunRecorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = '';

  start(canvas: HTMLCanvasElement, audioTrack: MediaStreamTrack): void {
    const videoTrack = canvas.captureStream(CONFIG.recordFps).getVideoTracks()[0];
    const stream = new MediaStream([videoTrack, audioTrack]);
    this.mime = pickMimeType();
    this.chunks = [];
    this.recorder = new MediaRecorder(stream, {
      ...(this.mime ? { mimeType: this.mime } : {}),
      videoBitsPerSecond: CONFIG.videoBitsPerSecond,
    });
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(1000); // timeslice avoids one giant end-of-run blob
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      const rec = this.recorder;
      if (!rec || rec.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: this.mime || 'video/webm' }));
        return;
      }
      rec.onstop = () => {
        rec.stream.getVideoTracks().forEach((t) => t.stop());
        resolve(new Blob(this.chunks, { type: this.mime || 'video/webm' }));
      };
      rec.stop();
    });
  }
}
