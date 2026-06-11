// Audio-thread pitch detector. Runs a YIN pitch estimate over a sliding window
// every `hopSize` samples (~5 ms), independent of the render framerate, and
// posts {freq, clarity, rms} to the main thread. Self-contained on purpose:
// AudioWorklet modules can't use imports, so the algorithm is inlined here.
//
// YIN (de Cheveigné & Kawahara 2002) is well suited to low-latency, low-pitch
// voice tracking. The analysis window is sized to the configured minimum
// frequency, so raising minFreq (e.g. after calibration for a higher voice)
// shrinks the window and cuts latency further.

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufSize = 2048;
    this.buf = new Float32Array(this.bufSize);
    this.writePos = 0;
    this.filled = 0;
    this.hopCounter = 0;

    this.hopSize = 256;
    this.minFreq = 80;
    this.maxFreq = 1100;
    this.threshold = 0.12; // YIN absolute threshold

    // Scratch buffers (max sized) to avoid per-detection allocation.
    this.work = new Float32Array(this.bufSize);
    this.diff = new Float32Array(this.bufSize / 2 + 1);
    this.cmnd = new Float32Array(this.bufSize / 2 + 1);

    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (typeof d.minFreq === 'number') this.minFreq = d.minFreq;
      if (typeof d.maxFreq === 'number') this.maxFreq = d.maxFreq;
      if (typeof d.hopSize === 'number') this.hopSize = d.hopSize;
      if (typeof d.threshold === 'number') this.threshold = d.threshold;
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.writePos] = ch[i];
      this.writePos = (this.writePos + 1) % this.bufSize;
      if (this.filled < this.bufSize) this.filled++;
      if (++this.hopCounter >= this.hopSize) {
        this.hopCounter = 0;
        this.detect();
      }
    }
    return true; // keep the processor alive
  }

  detect() {
    const sr = sampleRate; // AudioWorkletGlobalScope global
    const maxLag = Math.min(Math.floor(sr / this.minFreq), this.bufSize >> 1);
    const minLag = Math.max(2, Math.floor(sr / this.maxFreq));
    const win = Math.min(this.bufSize, maxLag * 2);
    if (this.filled < win) return;

    // Copy the most recent `win` samples out of the ring buffer, in order.
    const w = this.work;
    const start = (this.writePos - win + this.bufSize) % this.bufSize;
    let sumSq = 0;
    for (let i = 0; i < win; i++) {
      const s = this.buf[(start + i) % this.bufSize];
      w[i] = s;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / win);

    const integ = win - maxLag; // integration length
    const diff = this.diff;
    const cmnd = this.cmnd;

    // YIN difference function over the plausible lag range.
    diff[0] = 1;
    for (let tau = 1; tau <= maxLag; tau++) {
      let sum = 0;
      for (let j = 0; j < integ; j++) {
        const d = w[j] - w[j + tau];
        sum += d * d;
      }
      diff[tau] = sum;
    }

    // Cumulative mean normalized difference.
    cmnd[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxLag; tau++) {
      running += diff[tau];
      cmnd[tau] = running > 0 ? (diff[tau] * tau) / running : 1;
    }

    // Absolute threshold: first dip below threshold, then descend to its min.
    let tauEst = -1;
    for (let tau = minLag; tau <= maxLag; tau++) {
      if (cmnd[tau] < this.threshold) {
        while (tau + 1 <= maxLag && cmnd[tau + 1] < cmnd[tau]) tau++;
        tauEst = tau;
        break;
      }
    }

    if (tauEst === -1) {
      this.port.postMessage({ freq: null, clarity: 0, rms });
      return;
    }

    // Parabolic interpolation around the chosen lag for sub-sample accuracy.
    let betterTau = tauEst;
    if (tauEst > minLag && tauEst < maxLag) {
      const s0 = cmnd[tauEst - 1];
      const s1 = cmnd[tauEst];
      const s2 = cmnd[tauEst + 1];
      const denom = 2 * (2 * s1 - s2 - s0);
      if (denom !== 0) betterTau = tauEst + (s2 - s0) / denom;
    }

    const freq = sr / betterTau;
    const clarity = Math.max(0, Math.min(1, 1 - cmnd[tauEst])); // periodicity confidence
    this.port.postMessage({ freq, clarity, rms });
  }
}

registerProcessor('pitch-processor', PitchProcessor);
