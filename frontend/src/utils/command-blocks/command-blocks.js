/**
 * Command block tracker.
 *
 * Every time the user presses Enter in the terminal, a new command block
 * starts. Each block has a color (cycled from a palette) and a pair of
 * xterm markers (start + end) that follow the scrollback automatically.
 *
 * Rules (deliberately simple — no heuristics, no "smart" filtering):
 *   1. On Enter in normal buffer → close previous block, open new one.
 *   2. On switching to alternate buffer (vim/top/less/tmux) → close current,
 *      do nothing until we're back in normal and user presses Enter again.
 *   3. When a start marker is disposed (scrollback trimmed), drop the block.
 *   4. On hard reset (RIS / ESC c), drop all blocks at once — xterm wipes the
 *      buffer without disposing our markers, so we must clear them ourselves.
 *
 * Host-driven input (bottom command bar / WriteTerminal) never hits term.onData,
 * so callers that inject "\r" outside the terminal keyboard path must call
 * feedInput(data) themselves. Keyboard input still goes through onData only —
 * do not also feedInput the same keystroke, or blocks will double-open.
 *
 * This module owns no DOM. A renderer (e.g. the overlay bar) subscribes
 * via `onChange` and redraws.
 */

/** Golden-angle HSL cycling — infinite palette, no adjacent-hue collisions. */
function colorForIndex(i) {
  const hue = (i * 137.508) % 360;
  return `hsl(${hue.toFixed(1)}, 65%, 58%)`;
}

/**
 * @param {import('@xterm/xterm').Terminal} term
 * @returns {import('./types').CommandBlockTracker}
 */
export function createCommandBlockTracker(term) {
  /** @type {import('./types').CommandBlock[]} */
  const blocks = [];
  const listeners = new Set();
  let nextId = 1;
  /** @type {import('@xterm/xterm').IDisposable[]} */
  const disposables = [];

  const emit = () => listeners.forEach((fn) => fn());

  const closeCurrent = () => {
    const cur = blocks[blocks.length - 1];
    if (!cur || cur.end !== null) return;
    // Rule 2 close-on-switch: the active buffer is ALREADY the alternate one
    // here, so registerMarker would land on it and be disposed when the alt
    // buffer is torn down on exit — leaving the block end-less, so consumers
    // (bar / fold) grow it to the cursor forever and stacked tints turn grey.
    // The command that launched the alt program (less/vim/top) has no
    // normal-buffer output past its prompt line, so end it at its own start
    // marker, which stays valid across the alt round-trip.
    if (term.buffer.active.type === 'alternate') {
      cur.end = cur.start;
      return;
    }
    // Normal buffer: mark one line above the new prompt. registerMarker(-1) =
    // previous line. If that fails (cursor at top), fall back to current line.
    cur.end = term.registerMarker(-1) ?? term.registerMarker(0);
  };

  const openNew = () => {
    const start = term.registerMarker(0);
    if (!start) return; // can't mark — give up silently
    const id = nextId++;
    const block = {
      id,
      color: colorForIndex(id),
      start,
      end: null,
    };
    // When start marker is trimmed out of scrollback, drop the block.
    start.onDispose(() => {
      const i = blocks.indexOf(block);
      if (i >= 0) {
        blocks.splice(i, 1);
        emit();
      }
    });
    blocks.push(block);
    emit();
  };

  /** Process input for \r — shared by onData and host feedInput. */
  const handleInput = (data) => {
    if (term.buffer.active.type === 'alternate') return;
    for (const ch of data) {
      if (ch === '\r') {
        closeCurrent();
        openNew();
      }
    }
  };

  // Drop every block at once. Used on hard reset: the buffer is gone, so no
  // block corresponds to anything anymore. Snapshot-then-clear mirrors dispose():
  // start.dispose()'s onDispose does blocks.indexOf(block) — blocks already empty,
  // so it neither re-splices nor double-emits. One emit() at the end.
  const resetAll = () => {
    if (blocks.length === 0) return;
    const snapshot = blocks.slice();
    blocks.length = 0;
    for (const b of snapshot) {
      b.start.dispose();
      b.end?.dispose();
    }
    emit();
  };

  // Rule 1: Enter in normal buffer. Each `\r` = one new block (includes
  // multiline pastes — pasted lines each get their own block by design).
  disposables.push(
    term.onData((data) => {
      handleInput(data);
    }),
  );

  // Rule 2: buffer switch. Close on entering alternate; ignore return.
  disposables.push(
    term.buffer.onBufferChange((buf) => {
      if (buf.type === 'alternate') closeCurrent();
    }),
  );

  // Rule 4: hard reset. RIS (ESC c — from `reset` / `tput reset`) wipes the
  // buffer, but xterm does NOT dispose our markers (verified: marker.isDisposed
  // stays false), so every block would ghost over the cleared screen — and its
  // consumers (bar / selection halo / fold) with it. Drop them all. Return false
  // so xterm still performs the reset. Plain `clear` (ED3 + ED2) already disposes
  // markers via the ED2 leg, so it needs no handler here.
  if (term.parser?.registerEscHandler) {
    disposables.push(
      term.parser.registerEscHandler({ final: 'c' }, () => {
        resetAll();
        return false;
      }),
    );
  }

  return {
    get blocks() {
      return blocks;
    },
    /**
     * Host-driven input path (bottom command bar / WriteTerminal).
     * Same \r rules as onData. Do NOT call this for keystrokes that already
     * flow through term.onData — that would double-open blocks.
     * @param {string} data
     */
    feedInput(data) {
      handleInput(data);
    },
    onChange(fn) {
      listeners.add(fn);
      return { dispose: () => listeners.delete(fn) };
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      // Snapshot first: start.dispose()'s onDispose splices blocks,
      // so a direct forEach would skip later indices and leak markers.
      const snapshot = blocks.slice();
      blocks.length = 0;
      for (const b of snapshot) {
        b.start.dispose();
        b.end?.dispose();
      }
      listeners.clear();
    },
  };
}
