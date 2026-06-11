// Pause overlay. Continue resumes; Restart/Menu first ask what to do with the
// recording (save it / drop it / cancel and stay paused).

export interface PauseHandlers {
  onContinue: () => void;
  onRestart: (save: boolean) => void;
  onMenu: (save: boolean) => void;
  hasRecording: boolean;
}

export function showPauseMenu(parent: HTMLElement, handlers: PauseHandlers): () => void {
  const root = document.createElement('div');
  root.className = 'screen pause-screen';
  root.innerHTML = `
    <div class="start-panel pause-panel">
      <div class="pause-main">
        <h2 class="title small">PAUSED</h2>
        <button class="btn-start btn-continue">▶ Continue</button>
        <button class="btn-secondary btn-restart">↻ Restart</button>
        <button class="btn-secondary btn-menu">⏏ Menu</button>
      </div>
      <div class="pause-save" hidden>
        <h2 class="title small">RECORDING</h2>
        <p class="subtitle">Save the recording so far?</p>
        <button class="btn-download btn-save">⤓ Save .webm</button>
        <button class="btn-secondary btn-drop">🗑 Drop recording</button>
        <button class="btn-secondary btn-cancel">← Cancel</button>
      </div>
    </div>
  `;
  parent.appendChild(root);

  const mainView = root.querySelector<HTMLElement>('.pause-main')!;
  const saveView = root.querySelector<HTMLElement>('.pause-save')!;
  let pending: 'restart' | 'menu' | null = null;

  const showSavePrompt = (action: 'restart' | 'menu') => {
    if (!handlers.hasRecording) {
      // Nothing recorded — just proceed without prompting.
      action === 'restart' ? handlers.onRestart(false) : handlers.onMenu(false);
      return;
    }
    pending = action;
    mainView.hidden = true;
    saveView.hidden = false;
  };

  const proceed = (save: boolean) => {
    if (pending === 'restart') handlers.onRestart(save);
    else if (pending === 'menu') handlers.onMenu(save);
  };

  root.querySelector('.btn-continue')!.addEventListener('click', () => handlers.onContinue());
  root.querySelector('.btn-restart')!.addEventListener('click', () => showSavePrompt('restart'));
  root.querySelector('.btn-menu')!.addEventListener('click', () => showSavePrompt('menu'));
  root.querySelector('.btn-save')!.addEventListener('click', () => proceed(true));
  root.querySelector('.btn-drop')!.addEventListener('click', () => proceed(false));
  root.querySelector('.btn-cancel')!.addEventListener('click', () => {
    pending = null;
    saveView.hidden = true;
    mainView.hidden = false;
  });

  return () => root.remove();
}
