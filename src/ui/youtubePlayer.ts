// Corner YouTube player for karaoke songs that carry a backing video (UltraStar
// #VIDEO). The video is the real track AND the master clock: gameplay reads
// `currentTime` and starts/pauses with the video's play state. Built on the
// YouTube IFrame Player API, loaded once and shared.

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiReady: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiReady) return apiReady;
  apiReady = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return apiReady;
}

export interface YouTubePlayerOpts {
  videoId: string;
  onPlay: () => void;
  onPause: () => void;
  onEnded: () => void;
}

export class YouTubePlayer {
  private el: HTMLElement;
  private mount: HTMLElement;
  private player: any = null;
  private ready = false;

  constructor(parent: HTMLElement, private opts: YouTubePlayerOpts) {
    this.el = document.createElement('div');
    this.el.className = 'yt-pip centered'; // starts centered; docks to the corner on play
    this.mount = document.createElement('div'); // replaced by the iframe
    this.el.appendChild(this.mount);
    parent.appendChild(this.el);
    void this.init();
  }

  private async init(): Promise<void> {
    await loadApi();
    const YT = window.YT;
    this.player = new YT.Player(this.mount, {
      videoId: this.opts.videoId,
      playerVars: {
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        controls: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          this.ready = true;
        },
        onStateChange: (e: { data: number }) => {
          const S = YT.PlayerState;
          if (e.data === S.PLAYING) this.opts.onPlay();
          else if (e.data === S.PAUSED || e.data === S.BUFFERING) this.opts.onPause();
          else if (e.data === S.ENDED) this.opts.onEnded();
        },
      },
    });
  }

  /** Seconds into the video, or 0 before it is ready. */
  get currentTime(): number {
    return this.ready && this.player?.getCurrentTime ? this.player.getCurrentTime() : 0;
  }

  play(): void {
    this.player?.playVideo?.();
  }

  pause(): void {
    this.player?.pauseVideo?.();
  }

  seekTo(seconds: number): void {
    this.player?.seekTo?.(seconds, true);
  }

  /** Move from the big centered intro position to the small corner PiP. */
  dock(): void {
    this.el.classList.remove('centered');
  }

  dispose(): void {
    try {
      this.player?.destroy?.();
    } catch {
      /* player may not be fully constructed */
    }
    this.el.remove();
  }
}
