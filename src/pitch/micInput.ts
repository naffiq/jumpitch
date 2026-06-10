// Microphone capture. All DSP (echo cancellation etc.) is disabled because it
// destroys pitch fidelity. The mic source is never routed to the speakers.

export interface MicInput {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  dispose(): void;
}

export async function initMic(context: AudioContext, fftSize: number): Promise<MicInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = fftSize;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser); // analysis only — no audible path
  return {
    stream,
    source,
    analyser,
    dispose() {
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
