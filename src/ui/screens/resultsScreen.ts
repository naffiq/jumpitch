import type { RunStats } from '../../types';
import { letterGrade } from '../../game/scoring';

export function showResultsScreen(
  parent: HTMLElement,
  stats: RunStats,
  recording: Blob,
  onRetry: () => void,
  onMenu: () => void,
): () => void {
  const root = document.createElement('div');
  root.className = 'screen results-screen';
  const grade = letterGrade(stats);
  const url = URL.createObjectURL(recording);

  root.innerHTML = `
    <div class="start-panel results-panel">
      <h2 class="title small">${stats.failed ? 'RUN FAILED' : 'RUN COMPLETE'}</h2>
      <div class="grade grade-${grade}">${grade}</div>
      <div class="results-grid">
        <div><span class="r-label">Score</span><span class="r-value">${stats.score}</span></div>
        <div><span class="r-label">Accuracy</span><span class="r-value">${Math.round(stats.accuracy * 100)}%</span></div>
        <div><span class="r-label">Notes hit</span><span class="r-value">${stats.notesHit}/${stats.notesTotal}</span></div>
        <div><span class="r-label">Max streak</span><span class="r-value">×${stats.maxStreak}</span></div>
        <div><span class="r-label">Perfects</span><span class="r-value">${stats.perfects}</span></div>
        <div><span class="r-label">Spike hits</span><span class="r-value">${stats.spikeHits}</span></div>
      </div>
      <video class="replay" src="${url}" controls autoplay muted loop playsinline></video>
      <div class="results-actions">
        <a class="btn-download" href="${url}" download="jumpitch-run.webm">⤓ Download .webm</a>
        <button class="btn-secondary btn-retry">↻ Retry</button>
        <button class="btn-secondary btn-menu">Menu</button>
      </div>
    </div>
  `;
  parent.appendChild(root);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    root.remove();
  };
  root.querySelector('.btn-retry')!.addEventListener('click', () => {
    cleanup();
    onRetry();
  });
  root.querySelector('.btn-menu')!.addEventListener('click', () => {
    cleanup();
    onMenu();
  });

  return cleanup;
}
