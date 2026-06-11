// Microphone capture feeding the audio-thread pitch worklet. All browser DSP
// (echo cancellation etc.) is disabled because it destroys pitch fidelity and
// adds latency. The mic is never routed to the speakers.
//
// Tone.js wraps the AudioContext with standardized-audio-context, so the
// rawContext is NOT a native AudioContext. We must therefore create the worklet
// through standardized-audio-context's own AudioWorkletNode / addAudioWorkletModule
// (the native global constructors reject the wrapped context and throw).

import * as sac from 'standardized-audio-context';

// standardized-audio-context types these exports as possibly-undefined; pin
// the runtime shapes we use so they're callable/constructable.
const addAudioWorkletModule = sac.addAudioWorkletModule as (
  context: unknown,
  source: string,
) => Promise<void>;
const StdAudioWorkletNode = sac.AudioWorkletNode as unknown as {
  new (context: unknown, name: string, options?: Record<string, unknown>): AudioWorkletNode;
};

export interface MicOptions {
  minFreq: number;
  maxFreq: number;
  hopSize: number;
}

export interface MicInput {
  stream: MediaStream;
  source: MediaStreamAudioSourceNode;
  workletNode: AudioWorkletNode;
  dispose(): void;
}

let workletModuleLoaded = false;

async function ensureWorklet(context: AudioContext): Promise<void> {
  if (workletModuleLoaded) return;
  // `new URL(..., import.meta.url)` lets Vite emit the worklet as its own asset
  // in both dev and build. The file is dependency-free (AudioWorklet rule).
  const url = new URL('./pitchProcessor.worklet.js', import.meta.url);
  await addAudioWorkletModule(context, url.href);
  workletModuleLoaded = true;
}

export async function initMic(context: AudioContext, options: MicOptions): Promise<MicInput> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  await ensureWorklet(context);

  const source = context.createMediaStreamSource(stream);
  const workletNode = new StdAudioWorkletNode(context, 'pitch-processor', {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  workletNode.port.postMessage(options);
  source.connect(workletNode);

  // The worklet outputs silence; connect it through a muted gain to the
  // destination so the graph keeps pulling audio through it on every browser.
  const silent = context.createGain();
  silent.gain.value = 0;
  workletNode.connect(silent).connect(context.destination);

  return {
    stream,
    source,
    workletNode,
    dispose() {
      source.disconnect();
      workletNode.disconnect();
      silent.disconnect();
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}
