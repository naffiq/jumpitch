export interface Webcam {
  video: HTMLVideoElement;
  stop(): void;
}

export async function initWebcam(): Promise<Webcam> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: 'user' },
  });
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  // Some browsers ignore the properties unless the attributes are present too.
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');

  // Wait for real dimensions so the recording compositor can draw it.
  await new Promise<void>((resolve) => {
    if (video.readyState >= 1) return resolve();
    video.onloadedmetadata = () => resolve();
  });
  await video.play().catch(() => {}); // a re-play happens again once it's in the DOM

  return {
    video,
    stop() {
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
