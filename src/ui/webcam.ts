export interface Webcam {
  video: HTMLVideoElement;
  stop(): void;
}

export async function initWebcam(): Promise<Webcam> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 320 }, height: { ideal: 320 }, facingMode: 'user' },
  });
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  return {
    video,
    stop() {
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
