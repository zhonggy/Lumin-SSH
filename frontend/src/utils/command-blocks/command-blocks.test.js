import { describe, it, expect } from 'vitest';
import { Terminal } from '@xterm/xterm';
import { createCommandBlockTracker } from './command-blocks.js';

/* ─────────────────────────────────────────────────────────────
 * Fake xterm.js Terminal — minimal subset used by the tracker.
 * ───────────────────────────────────────────────────────────── */

function fakeTerm() {
  let bufferType = 'normal';
  const dataListeners = new Set();
  const bufferChangeListeners = new Set();
  const escHandlers = new Set();
  let markerCounter = 0;
  const allMarkers = [];

  const makeMarker = () => {
    const onDisposeFns = [];
    const m = {
      id: ++markerCounter,
      disposed: false,
      createdOn: bufferType,
      get isDisposed() {
        return this.disposed;
      },
      onDispose(fn) {
        onDisposeFns.push(fn);
        return { dispose: () => {} };
      },
      dispose() {
        if (this.disposed) return;
        this.disposed = true;
        onDisposeFns.forEach((f) => f());
      },
    };
    allMarkers.push(m);
    return m;
  };

  const term = {
    onData(fn) {
      dataListeners.add(fn);
      return { dispose: () => dataListeners.delete(fn) };
    },
    buffer: {
      get active() {
        return { type: bufferType };
      },
      onBufferChange(fn) {
        bufferChangeListeners.add(fn);
        return { dispose: () => bufferChangeListeners.delete(fn) };
      },
    },
    registerMarker(_line) {
      return makeMarker();
    },
    parser: {
      registerEscHandler(id, handler) {
        const entry = { final: id.final, handler };
        escHandlers.add(entry);
        return { dispose: () => escHandlers.delete(entry) };
      },
    },
  };

  return {
    term,
    pushData(s) {
      dataListeners.forEach((f) => f(s));
    },
    setBuffer(t) {
      const leavingAlt = bufferType === 'alternate' && t === 'normal';
      bufferType = t;
      if (leavingAlt) {
        for (const m of allMarkers) {
          if (m.createdOn === 'alternate' && !m.disposed) m.dispose();
        }
      }
      bufferChangeListeners.forEach((f) => f({ type: t }));
    },
    triggerEsc(final) {
      for (const e of escHandlers) if (e.final === final) e.handler();
    },
    markers: allMarkers,
    listenerCount: () =>
      dataListeners.size + bufferChangeListeners.size + escHandlers.size,
  };
}

describe('createCommandBlockTracker — Enter opens blocks', () => {
  it('starts with no blocks', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    expect(t.blocks.length).toBe(0);
    t.dispose();
  });

  it('Enter in normal buffer opens a new block', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    expect(t.blocks.length).toBe(1);
    expect(t.blocks[0].end).toBeNull();
    expect(typeof t.blocks[0].color).toBe('string');
    expect(t.blocks[0].color).toMatch(/^hsl\(/);
    t.dispose();
  });

  it('multiple Enters open multiple blocks with distinct colors', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.pushData('\r');
    f.pushData('\r');
    expect(t.blocks.length).toBe(3);
    const colors = t.blocks.map((b) => b.color);
    expect(new Set(colors).size).toBe(3);
    expect(t.blocks[0].end).not.toBeNull();
    expect(t.blocks[1].end).not.toBeNull();
    expect(t.blocks[2].end).toBeNull();
    t.dispose();
  });

  it('ids increment monotonically', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r\r');
    expect(t.blocks[1].id).toBeGreaterThan(t.blocks[0].id);
    t.dispose();
  });

  it('non-Enter chars do not open blocks', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('ls -la');
    expect(t.blocks.length).toBe(0);
    t.dispose();
  });

  it('Enter in alternate buffer is ignored', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.setBuffer('alternate');
    f.pushData('\r');
    f.pushData('\r');
    expect(t.blocks.length).toBe(0);
    t.dispose();
  });

  it('paste of multi-line input opens one block per \\r', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('first\rsecond\rthird\r');
    expect(t.blocks.length).toBe(3);
    t.dispose();
  });
});

describe('createCommandBlockTracker — feedInput (host path)', () => {
  it('feedInput("\\r") opens a block without going through onData', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    t.feedInput('\r');
    expect(t.blocks.length).toBe(1);
    t.dispose();
  });

  it('feedInput is ignored in alternate buffer', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.setBuffer('alternate');
    t.feedInput('\r');
    expect(t.blocks.length).toBe(0);
    t.dispose();
  });
});

describe('createCommandBlockTracker — buffer switch closes current', () => {
  it('entering alternate buffer closes the current open block', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    expect(t.blocks[0].end).toBeNull();
    f.setBuffer('alternate');
    expect(t.blocks[0].end).not.toBeNull();
    t.dispose();
  });

  it('returning to normal buffer does NOT auto-open a block', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.setBuffer('alternate');
    f.setBuffer('normal');
    expect(t.blocks.length).toBe(1);
    expect(t.blocks[0].end).not.toBeNull();
    t.dispose();
  });

  it('survives an alt-buffer round-trip with a still-valid end marker', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.setBuffer('alternate');
    f.setBuffer('normal');
    const b = t.blocks[0];
    expect(b.end).not.toBeNull();
    expect(b.end.isDisposed).toBe(false);
    t.dispose();
  });

  it('repeated alt-buffer sessions each keep a valid end marker', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    for (let i = 0; i < 3; i++) {
      f.pushData('\r');
      f.setBuffer('alternate');
      f.setBuffer('normal');
    }
    for (const b of t.blocks) {
      expect(b.end).not.toBeNull();
      expect(b.end.isDisposed).toBe(false);
    }
    t.dispose();
  });
});

describe('createCommandBlockTracker — onChange notifications', () => {
  it('fires onChange on each block open', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    let calls = 0;
    t.onChange(() => calls++);
    f.pushData('\r');
    f.pushData('\r');
    expect(calls).toBe(2);
    t.dispose();
  });

  it('onChange unsubscribe stops further calls', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    let calls = 0;
    const sub = t.onChange(() => calls++);
    f.pushData('\r');
    sub.dispose();
    f.pushData('\r');
    expect(calls).toBe(1);
    t.dispose();
  });
});

describe('createCommandBlockTracker — marker disposal', () => {
  it('disposing a start marker drops the block from the list', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.pushData('\r');
    expect(t.blocks.length).toBe(2);
    t.blocks[0].start.dispose();
    expect(t.blocks.length).toBe(1);
    t.dispose();
  });

  it('dispose() empties the blocks array', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.pushData('\r');
    expect(t.blocks.length).toBe(2);
    t.dispose();
    expect(t.blocks.length).toBe(0);
  });

  it('dispose() disposes markers of all blocks, not just the first', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.pushData('\r');
    const totalBefore = f.markers.length;
    expect(totalBefore).toBeGreaterThan(0);
    t.dispose();
    for (const m of f.markers) {
      expect(m.disposed).toBe(true);
    }
  });

  it('dispose() unsubscribes onData / onBufferChange listeners', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    expect(f.listenerCount()).toBeGreaterThan(0);
    t.dispose();
    expect(f.listenerCount()).toBe(0);
  });

  it('after dispose() further pushData / setBuffer cause no state change', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    t.dispose();
    let onChangeCalls = 0;
    t.onChange(() => onChangeCalls++);
    f.pushData('\r');
    f.setBuffer('alternate');
    f.setBuffer('normal');
    expect(t.blocks.length).toBe(0);
    expect(onChangeCalls).toBe(0);
  });
});

describe('createCommandBlockTracker — hard reset (RIS)', () => {
  it('RIS (ESC c) drops every block and fires onChange once', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    f.pushData('\r');
    f.pushData('\r');
    f.pushData('\r');
    expect(t.blocks.length).toBe(3);
    let changes = 0;
    t.onChange(() => changes++);
    f.triggerEsc('c');
    expect(t.blocks.length).toBe(0);
    expect(changes).toBe(1);
    t.dispose();
  });

  it('RIS on an empty tracker is a no-op (no spurious onChange)', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    let changes = 0;
    t.onChange(() => changes++);
    f.triggerEsc('c');
    expect(changes).toBe(0);
    t.dispose();
  });

  it('dispose() unsubscribes the RIS handler too', () => {
    const f = fakeTerm();
    const t = createCommandBlockTracker(f.term);
    expect(f.listenerCount()).toBeGreaterThan(0);
    t.dispose();
    expect(f.listenerCount()).toBe(0);
  });
});

describe('createCommandBlockTracker — hard reset (real xterm contract)', () => {
  const writeP = (term, d) =>
    new Promise((r) => term.write(d, () => r()));

  it("RIS (\\x1bc) invokes a {final:'c'} ESC handler; markers survive it", async () => {
    const term = new Terminal({ allowProposedApi: true, scrollback: 1000 });
    let fired = 0;
    const disp = term.parser.registerEscHandler({ final: 'c' }, () => {
      fired++;
      return false;
    });
    await writeP(term, 'line1\r\nline2\r\n');
    const marker = term.registerMarker(0);
    const cursorYBefore = term.buffer.active.cursorY;
    expect(cursorYBefore).toBeGreaterThan(0);
    await writeP(term, '\x1bc');
    expect(fired).toBe(1);
    expect(marker?.isDisposed).toBe(false);
    expect(term.buffer.active.cursorY).toBe(0);
    disp.dispose();
    term.dispose();
  });

  it('a marker registered on the alternate buffer is disposed on return to normal', async () => {
    const term = new Terminal({ allowProposedApi: true, scrollback: 1000 });
    await writeP(term, 'line1\r\nline2\r\nline3\r\n');
    const normalMarker = term.registerMarker(0);
    expect(term.buffer.active.type).toBe('normal');

    await writeP(term, '\x1b[?1049h');
    expect(term.buffer.active.type).toBe('alternate');
    const altMarker = term.registerMarker(0);

    await writeP(term, '\x1b[?1049l');
    expect(term.buffer.active.type).toBe('normal');

    expect(normalMarker?.isDisposed).toBe(false);
    expect(altMarker?.isDisposed).toBe(true);
    term.dispose();
  });
});
