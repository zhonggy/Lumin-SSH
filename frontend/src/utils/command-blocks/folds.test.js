import { describe, it, expect } from 'vitest';
import { createFoldStore } from './folds.js';

/* ─────────────────────────────────────────────────────────────
 * Fake xterm.js Terminal — private buffer API used by folds.js.
 * ───────────────────────────────────────────────────────────── */

function fakeBlankLine() {
  const line = { content: '<blank>', isWrapped: false };
  line.getTrimmedLength = () => (line.content === '<blank>' ? 0 : line.content.length);
  return line;
}

function fakeTerm(opts) {
  const rows = opts.rows;
  const maxLength = opts.maxLength;
  let ybase = opts.ybase ?? 0;
  let ydisp = ybase;
  let y = opts.cursorY;
  const lineArray = [];
  for (let i = 0; i < opts.initialLines; i++) lineArray.push({ content: `L${i}` });

  let markerSeq = 0;
  const markers = [];

  const makeMarker = (line) => {
    const onDisposeFns = [];
    const m = {
      id: ++markerSeq,
      line,
      isDisposed: false,
      onDispose(fn) {
        onDisposeFns.push(fn);
        return { dispose: () => {} };
      },
      dispose() {
        if (this.isDisposed) return;
        this.isDisposed = true;
        this.line = -1;
        onDisposeFns.forEach((f) => f());
      },
    };
    markers.push(m);
    return m;
  };

  function trimHead(count) {
    if (count <= 0) return;
    lineArray.splice(0, count);
    for (const m of markers) {
      if (m.isDisposed) continue;
      m.line -= count;
      if (m.line < 0) m.dispose();
    }
  }

  function enforceMaxLength() {
    if (!maxLength || lineArray.length <= maxLength) return;
    trimHead(lineArray.length - maxLength);
  }

  const lines = {
    get length() {
      return lineArray.length;
    },
    get(i) {
      return lineArray[i];
    },
    splice(start, deleteCount, ...items) {
      if (deleteCount > 0) {
        lineArray.splice(start, deleteCount);
        for (const m of markers) {
          if (m.isDisposed) continue;
          if (m.line >= start && m.line < start + deleteCount) m.dispose();
          else if (m.line >= start + deleteCount) m.line -= deleteCount;
        }
      }
      if (items.length > 0) {
        lineArray.splice(start, 0, ...items);
        for (const m of markers) {
          if (m.isDisposed) continue;
          if (m.line >= start) m.line += items.length;
        }
        enforceMaxLength();
      }
    },
    push(item) {
      lineArray.push(item);
    },
    pop() {
      return lineArray.pop();
    },
  };

  const buffer = {
    lines,
    get ybase() {
      return ybase;
    },
    set ybase(v) {
      ybase = v;
    },
    get ydisp() {
      return ydisp;
    },
    set ydisp(v) {
      ydisp = v;
    },
    get y() {
      return y;
    },
    set y(v) {
      y = v;
    },
    getBlankLine: (_attr) => fakeBlankLine(),
    addMarker: (line) => makeMarker(line),
  };

  const resizeListeners = new Set();
  const cursorMoveListeners = new Set();
  const lineFeedListeners = new Set();
  let activeBufferType = 'normal';

  const term = {
    rows,
    buffer: {
      get active() {
        return { type: activeBufferType };
      },
    },
    refresh: (_a, _b) => {},
    onResize(fn) {
      resizeListeners.add(fn);
      return { dispose: () => resizeListeners.delete(fn) };
    },
    onCursorMove(fn) {
      cursorMoveListeners.add(fn);
      return { dispose: () => cursorMoveListeners.delete(fn) };
    },
    onLineFeed(fn) {
      lineFeedListeners.add(fn);
      return { dispose: () => lineFeedListeners.delete(fn) };
    },
    _core: { buffer },
  };

  return {
    term,
    buffer,
    lineContents: () => lineArray.map((l) => l.content),
    lineRefs: () => [...lineArray],
    markers,
    makeMarker,
    lineFeed: () => {
      y = Math.min(rows - 1, y + 1);
      lineFeedListeners.forEach((fn) => fn());
    },
    moveCursorTo: (nextY) => {
      y = nextY;
      cursorMoveListeners.forEach((fn) => fn());
    },
    fireCursorMove: () => cursorMoveListeners.forEach((fn) => fn()),
    setActiveBuffer: (type) => {
      activeBufferType = type;
    },
    triggerResize: () => resizeListeners.forEach((fn) => fn()),
    snapshot: () => ({
      length: lineArray.length,
      ybase,
      ydisp,
      y,
      cursorAbs: ybase + y,
    }),
  };
}

function fakeTracker(blocks) {
  const listeners = new Set();
  return {
    get blocks() {
      return blocks;
    },
    onChange(fn) {
      listeners.add(fn);
      return { dispose: () => listeners.delete(fn) };
    },
    dispose() {
      listeners.clear();
    },
    fire() {
      listeners.forEach((fn) => fn());
    },
  };
}

function makeBlock(id, start, end) {
  return { id, color: 'hsl(0,0%,50%)', start, end };
}

describe('FoldStore — fold() validation', () => {
  it('refuses unknown blockId', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const tracker = fakeTracker([]);
    const store = createFoldStore(f.term, tracker);
    expect(store.fold(99)).toBe(false);
    store.dispose();
  });

  it('refuses block without end (open block)', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const start = f.makeMarker(0);
    const tracker = fakeTracker([makeBlock(1, start, null)]);
    const store = createFoldStore(f.term, tracker);
    expect(store.fold(1)).toBe(false);
    store.dispose();
  });

  it('refuses block with empty body (start+1 > end)', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(5);
    const e = f.makeMarker(5);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    expect(store.fold(1)).toBe(false);
    store.dispose();
  });

  it('refuses if fold range overlaps cursor', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 5 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(10);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    expect(store.fold(1)).toBe(false);
    store.dispose();
  });

  it('refuses double-fold of the same block', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    expect(store.fold(1)).toBe(true);
    expect(store.fold(1)).toBe(false);
    store.dispose();
  });
});

describe('FoldStore — fold() effects', () => {
  it('fold preserves lines.length (push blanks compensates splice)', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    const before = f.snapshot();
    store.fold(1);
    const after = f.snapshot();
    expect(after.length).toBe(before.length);
    store.dispose();
  });

  it("fold preserves cursor's content position (cursorAbs -= count)", () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    const before = f.snapshot();
    store.fold(1);
    const after = f.snapshot();
    expect(after.cursorAbs).toBe(before.cursorAbs - 12);
    store.dispose();
  });

  it("fold disposes block.end (it's inside the splice range)", () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    expect(e.isDisposed).toBe(true);
    expect(s.isDisposed).toBe(false);
    store.dispose();
  });

  it('fold auto-migrates markers AFTER the splice range', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 20 });
    const s1 = f.makeMarker(0);
    const e1 = f.makeMarker(12);
    const s2 = f.makeMarker(13);
    const e2 = f.makeMarker(15);
    const tracker = fakeTracker([
      makeBlock(1, s1, e1),
      makeBlock(2, s2, e2),
    ]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    expect(s2.line).toBe(1);
    expect(e2.line).toBe(3);
    store.dispose();
  });

  it('isFolded reflects state', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    expect(store.isFolded(1)).toBe(false);
    store.fold(1);
    expect(store.isFolded(1)).toBe(true);
    store.dispose();
  });
});

describe('FoldStore — unfold() effects', () => {
  it('unfold pops pushed blanks → buffer length restored to pre-fold (safe path)', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    const before = f.snapshot();
    store.fold(1);
    store.unfold(1);
    const after = f.snapshot();
    expect(after.length).toBe(before.length);
  });

  it('unfold with scrollback (ybase>0) restores length precisely (pushCount<count)', () => {
    const f = fakeTerm({ rows: 24, initialLines: 38, cursorY: 23, ybase: 14 });
    const s = f.makeMarker(20);
    const e = f.makeMarker(30);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    const before = f.snapshot();
    store.fold(1);
    expect(f.snapshot().ybase).toBe(4);
    store.unfold(1);
    const after = f.snapshot();
    expect(after.length).toBe(before.length);
    expect(after.ybase).toBe(before.ybase);
    expect(after.cursorAbs).toBe(before.cursorAbs);
  });

  it('unfold removes still-blank compensation lines when later output is appended', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    f.buffer.lines.push({ content: '<user-output>' });
    const afterFold = f.snapshot();
    store.unfold(1);
    const afterUnfold = f.snapshot();
    expect(afterUnfold.length).toBe(afterFold.length);
    expect(f.lineContents()).toContain('<user-output>');
  });

  it('unfold keeps blank compensation lines the cursor has consumed', () => {
    const f = fakeTerm({ rows: 10, initialLines: 10, cursorY: 9 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(8);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    const consumed = store.getFold(1).pushedBlankRefs[0];
    f.buffer.y = 2;
    const afterFold = f.snapshot();
    store.unfold(1);
    const afterUnfold = f.snapshot();
    expect(afterUnfold.length).toBe(afterFold.length + 1);
    expect(f.lineRefs()).toContain(consumed);
  });

  it('unfold keeps consumed blank lines after the cursor moves back', () => {
    const f = fakeTerm({ rows: 10, initialLines: 10, cursorY: 9 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(8);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    const consumedBlank = store.getFold(1).pushedBlankRefs[0];
    const outputLine = store.getFold(1).pushedBlankRefs[1];

    f.lineFeed();
    f.lineFeed();
    outputLine.content = '<user-output>';
    f.moveCursorTo(1);

    const afterFold = f.snapshot();
    store.unfold(1);
    const refs = f.lineRefs();
    expect(f.snapshot().length).toBe(afterFold.length + 2);
    expect(refs.indexOf(outputLine)).toBe(refs.indexOf(consumedBlank) + 1);
  });

  it('unfold preserves the blank prefix before output written in one cursor batch', () => {
    const f = fakeTerm({ rows: 10, initialLines: 10, cursorY: 9 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(8);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    const first = store.getFold(1).pushedBlankRefs[0];
    const second = store.getFold(1).pushedBlankRefs[1];

    second.content = '<batched-output>';
    f.moveCursorTo(1);

    store.unfold(1);

    const refs = f.lineRefs();
    expect(refs.indexOf(second)).toBe(refs.indexOf(first) + 1);
  });

  it('unfold keeps a compensation line that was replaced by user output', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(4);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    f.buffer.lines.pop();
    f.buffer.lines.push({ content: '<user-output>' });
    const afterFold = f.snapshot();
    store.unfold(1);
    const afterUnfold = f.snapshot();
    expect(afterUnfold.length).toBe(afterFold.length + 1);
    expect(f.lineContents()).toContain('<user-output>');
  });

  it('unfold keeps the compensation prefix before reused user output', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(4);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    const reused = store.getFold(1).pushedBlankRefs[3];
    reused.content = '<user-output>';
    const afterFold = f.snapshot();
    store.unfold(1);
    const afterUnfold = f.snapshot();
    expect(afterUnfold.length).toBe(afterFold.length + 4);
    expect(f.lineContents()).toContain('<user-output>');
  });

  it('unfold preserves cursor content position', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    const before = f.snapshot();
    store.fold(1);
    store.unfold(1);
    const after = f.snapshot();
    expect(after.cursorAbs).toBe(before.cursorAbs);
  });

  it('unfold re-registers block.end at correct line', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const block = makeBlock(1, s, e);
    const tracker = fakeTracker([block]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    expect(block.end?.isDisposed).toBe(true);
    store.unfold(1);
    expect(block.end).not.toBeNull();
    expect(block.end?.isDisposed).toBe(false);
    expect(block.end?.line).toBe(12);
  });

  it('unfold returns false for unknown blockId', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const tracker = fakeTracker([]);
    const store = createFoldStore(f.term, tracker);
    expect(store.unfold(99)).toBe(false);
    store.dispose();
  });

  it('unfold drops fold record if block.start was disposed (scrollback trim)', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const block = makeBlock(1, s, e);
    const tracker = fakeTracker([block]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    s.dispose();
    expect(store.unfold(1)).toBe(false);
    expect(store.isFolded(1)).toBe(false);
  });

  it('unfold commits buffer coordinates if insert trimming disposes block.start', () => {
    const f = fakeTerm({ rows: 5, initialLines: 6, cursorY: 4, ybase: 1, maxLength: 6 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(2);
    const block = makeBlock(1, s, e);
    const tracker = fakeTracker([block]);
    const store = createFoldStore(f.term, tracker);

    store.fold(1);
    const compensation = [...store.getFold(1).pushedBlankRefs];
    const markerCountAfterFold = f.markers.length;

    expect(store.unfold(1)).toBe(false);
    expect(s.isDisposed).toBe(true);
    expect(store.isFolded(1)).toBe(false);
    expect(f.markers.length).toBe(markerCountAfterFold);
    expect(block.end?.isDisposed).toBe(true);
    expect(compensation.some((line) => f.lineRefs().includes(line))).toBe(false);
    expect(f.snapshot()).toEqual({
      length: 5,
      ybase: 0,
      ydisp: 0,
      y: 4,
      cursorAbs: 4,
    });
  });

  it('unfold pads the viewport after head trim removes more history than padding', () => {
    const f = fakeTerm({ rows: 5, initialLines: 6, cursorY: 4, ybase: 1, maxLength: 6 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(4);
    const block = makeBlock(1, s, e);
    const tracker = fakeTracker([block]);
    const store = createFoldStore(f.term, tracker);

    store.fold(1);
    const compensation = [...store.getFold(1).pushedBlankRefs];

    expect(store.unfold(1)).toBe(false);
    expect(s.isDisposed).toBe(true);
    expect(compensation.some((line) => f.lineRefs().includes(line))).toBe(false);
    expect(f.lineContents()).toEqual(['L3', 'L4', 'L5', '<blank>', '<blank>']);
    expect(f.snapshot()).toEqual({
      length: 5,
      ybase: 0,
      ydisp: 0,
      y: 2,
      cursorAbs: 2,
    });
  });

  it('keeps multi-chunk insertion ordered when CircularList trims after each chunk', () => {
    const f = fakeTerm({
      rows: 40_010,
      initialLines: 40_010,
      cursorY: 40_009,
      maxLength: 40_010,
    });
    const s = f.makeMarker(0);
    const e = f.makeMarker(33_000);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);

    expect(store.fold(1)).toBe(true);
    store.unfold(1);

    const survivingLineNumbers = f.lineContents()
      .filter((line) => /^L\d+$/.test(line))
      .map((line) => Number(line.slice(1)));
    expect(survivingLineNumbers).toEqual([...survivingLineNumbers].sort((a, b) => a - b));
  });
});

describe('FoldStore — multiple folds', () => {
  it('fold two distinct blocks, both tracked independently', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 19 });
    const s1 = f.makeMarker(0);
    const e1 = f.makeMarker(5);
    const s2 = f.makeMarker(6);
    const e2 = f.makeMarker(12);
    const tracker = fakeTracker([
      makeBlock(1, s1, e1),
      makeBlock(2, s2, e2),
    ]);
    const store = createFoldStore(f.term, tracker);
    expect(store.fold(1)).toBe(true);
    expect(store.fold(2)).toBe(true);
    expect(store.isFolded(1)).toBe(true);
    expect(store.isFolded(2)).toBe(true);
    expect(store.folds.length).toBe(2);
  });

  it("unfold preserves the OTHER fold's state", () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 19 });
    const s1 = f.makeMarker(0);
    const e1 = f.makeMarker(5);
    const s2 = f.makeMarker(6);
    const e2 = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s1, e1), makeBlock(2, s2, e2)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    store.fold(2);
    store.unfold(2);
    expect(store.isFolded(1)).toBe(true);
    expect(store.isFolded(2)).toBe(false);
  });

  it('unfolds multiple folds in non-LIFO order without leaking compensation blanks', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 19 });
    const s1 = f.makeMarker(0);
    const e1 = f.makeMarker(5);
    const s2 = f.makeMarker(6);
    const e2 = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s1, e1), makeBlock(2, s2, e2)]);
    const store = createFoldStore(f.term, tracker);
    const before = f.snapshot();
    const beforeLines = f.lineContents();

    store.fold(1);
    store.fold(2);
    store.unfold(1);
    store.unfold(2);

    expect(f.snapshot()).toEqual(before);
    expect(f.lineContents()).toEqual(beforeLines);
  });
});

describe('FoldStore — auto-cleanup', () => {
  it('unfoldAll expands active folds before resize', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    expect(store.isFolded(1)).toBe(true);
    store.unfoldAll();
    expect(store.isFolded(1)).toBe(false);
  });

  it('binds folds to normal history while alternate buffer is active', () => {
    const normal = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const alternate = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = normal.makeMarker(0);
    const e = normal.makeMarker(4);
    const bodyRef = normal.lineRefs()[1];
    const alternateBefore = alternate.lineRefs();
    const core = normal.term._core;
    core.buffer = alternate.buffer;
    core.buffers = { normal: normal.buffer };

    const store = createFoldStore(normal.term, fakeTracker([makeBlock(1, s, e)]));
    expect(store.fold(1)).toBe(true);

    expect(normal.lineRefs()).not.toContain(bodyRef);
    expect(alternate.lineRefs()).toEqual(alternateBefore);
  });

  it('ignores alternate-buffer cursor events when tracking normal compensation rows', () => {
    const f = fakeTerm({ rows: 10, initialLines: 10, cursorY: 9 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(8);
    const store = createFoldStore(f.term, fakeTracker([makeBlock(1, s, e)]));
    const before = f.snapshot();

    expect(store.fold(1)).toBe(true);
    f.buffer.y = 2;
    f.setActiveBuffer('alternate');
    f.fireCursorMove();
    f.buffer.y = 1;
    store.unfold(1);

    expect(f.snapshot().length).toBe(before.length);
  });

  it('tracker drops a folded block → fold record auto-dropped', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const blocks = [makeBlock(1, s, e)];
    const tracker = fakeTracker(blocks);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    blocks.length = 0;
    tracker.fire();
    expect(store.isFolded(1)).toBe(false);
    expect(store.folds.length).toBe(0);
  });

  it('dispose() clears state and unsubscribes listeners', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    store.fold(1);
    let onChangeCalls = 0;
    store.onChange(() => onChangeCalls++);
    store.dispose();
    expect(store.folds.length).toBe(0);
    f.triggerResize();
    expect(onChangeCalls).toBe(0);
  });
});

describe('FoldStore — onChange notifications', () => {
  it('fires onChange on fold/unfold', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const s = f.makeMarker(0);
    const e = f.makeMarker(12);
    const tracker = fakeTracker([makeBlock(1, s, e)]);
    const store = createFoldStore(f.term, tracker);
    let calls = 0;
    store.onChange(() => calls++);
    store.fold(1);
    expect(calls).toBe(1);
    store.unfold(1);
    expect(calls).toBe(2);
  });

  it('does NOT fire onChange on failed fold', () => {
    const f = fakeTerm({ rows: 24, initialLines: 24, cursorY: 14 });
    const tracker = fakeTracker([]);
    const store = createFoldStore(f.term, tracker);
    let calls = 0;
    store.onChange(() => calls++);
    store.fold(99);
    expect(calls).toBe(0);
    store.dispose();
  });
});
