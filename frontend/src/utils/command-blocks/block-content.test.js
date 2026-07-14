import { describe, it, expect } from 'vitest';
import {
  extractBlocksText,
  extractRangeLines,
  resolveBlockLines,
  resolveBlockRanges,
} from './block-content.js';

/* ─────────────────────────────────────────────────────────────
 * Fake xterm Terminal/Buffer/Line/Cell — minimal subset.
 * Spec syntax: "{w2}X" = wide char (getWidth=2 + next cell width=0).
 * ───────────────────────────────────────────────────────────── */

function lineFromSpec(spec, wrapped = false) {
  const cells = [];
  let i = 0;
  while (i < spec.length) {
    if (spec.startsWith('{w2}', i)) {
      const ch = spec[i + 4];
      cells.push({ ch, width: 2 });
      cells.push({ ch: '', width: 0 });
      i += 5;
    } else {
      cells.push({ ch: spec[i], width: 1 });
      i++;
    }
  }
  return {
    length: cells.length,
    isWrapped: wrapped,
    getCell(x) {
      const c = cells[x];
      if (!c) return undefined;
      return {
        getChars: () => c.ch,
        getWidth: () => c.width,
      };
    },
  };
}

function fakeBuf(lines) {
  return {
    baseY: 0,
    cursorY: Math.max(0, lines.length - 1),
    getLine(i) {
      return lines[i];
    },
  };
}

function fakeTerm(lines) {
  return {
    buffer: { active: fakeBuf(lines) },
  };
}

function fakeMarker(line, disposed = false) {
  return { line, isDisposed: disposed };
}

function fakeBlock(id, startLine, endLine) {
  return {
    id,
    color: '',
    start: fakeMarker(startLine),
    end: endLine === null ? null : fakeMarker(endLine),
  };
}

describe('extractRangeLines', () => {
  it('trims trailing spaces per logical line', () => {
    const buf = fakeBuf([
      lineFromSpec('hello world          '),
      lineFromSpec('foo                  '),
    ]);
    expect(extractRangeLines(buf, 0, 1)).toEqual(['hello world', 'foo']);
  });

  it('merges wrapped continuation rows into one logical line', () => {
    const buf = fakeBuf([
      lineFromSpec('aaa'),
      lineFromSpec('bbb', true),
      lineFromSpec('ccc'),
    ]);
    expect(extractRangeLines(buf, 0, 2)).toEqual(['aaabbb', 'ccc']);
  });

  it('preserves spaces at wrap boundary inside a logical line', () => {
    const buf = fakeBuf([
      lineFromSpec('a   '),
      lineFromSpec('b   ', true),
    ]);
    expect(extractRangeLines(buf, 0, 1)).toEqual(['a   b']);
  });

  it('skips width=0 continuation cells of CJK wide chars', () => {
    const buf = fakeBuf([lineFromSpec('{w2}你{w2}好     ')]);
    expect(extractRangeLines(buf, 0, 0)).toEqual(['你好']);
  });

  it('treats empty cells as spaces inside content', () => {
    const buf = fakeBuf([lineFromSpec('a b   c        ')]);
    expect(extractRangeLines(buf, 0, 0)).toEqual(['a b   c']);
  });

  it('returns [] for missing lines', () => {
    const buf = fakeBuf([]);
    expect(extractRangeLines(buf, 0, 5)).toEqual([]);
  });
});

describe('resolveBlockRanges', () => {
  it('uses end.line when end exists and not disposed', () => {
    const term = fakeTerm([
      lineFromSpec('a'),
      lineFromSpec('b'),
      lineFromSpec('c'),
    ]);
    const ranges = resolveBlockRanges(term, [fakeBlock(1, 0, 2)]);
    expect(ranges).toEqual([{ id: 1, startLine: 0, endLine: 2 }]);
  });

  it('falls back to cursor abs when end is null (block still growing)', () => {
    const term = fakeTerm([
      lineFromSpec('a'),
      lineFromSpec('b'),
      lineFromSpec('c'),
    ]);
    const ranges = resolveBlockRanges(term, [fakeBlock(7, 0, null)]);
    expect(ranges).toEqual([{ id: 7, startLine: 0, endLine: 2 }]);
  });

  it('skips blocks whose start marker is disposed', () => {
    const term = fakeTerm([lineFromSpec('a')]);
    const block = {
      id: 1,
      color: '',
      start: { line: 0, isDisposed: true },
      end: null,
    };
    expect(resolveBlockRanges(term, [block])).toEqual([]);
  });

  it('falls back when end is disposed', () => {
    const term = fakeTerm([lineFromSpec('a'), lineFromSpec('b')]);
    const block = {
      id: 1,
      color: '',
      start: fakeMarker(0),
      end: { line: 99, isDisposed: true },
    };
    expect(resolveBlockRanges(term, [block])).toEqual([
      { id: 1, startLine: 0, endLine: 1 },
    ]);
  });

  it('skips ranges where endLine < startLine', () => {
    const term = fakeTerm([lineFromSpec('a')]);
    expect(resolveBlockRanges(term, [fakeBlock(1, 5, null)])).toEqual([]);
  });

  it('returns ranges sorted by id ascending (time order)', () => {
    const term = fakeTerm([
      lineFromSpec('a'),
      lineFromSpec('b'),
      lineFromSpec('c'),
    ]);
    const ranges = resolveBlockRanges(term, [
      fakeBlock(3, 2, 2),
      fakeBlock(1, 0, 0),
      fakeBlock(2, 1, 1),
    ]);
    expect(ranges.map((r) => r.id)).toEqual([1, 2, 3]);
  });
});

describe('extractBlocksText', () => {
  it('returns empty string for empty input', () => {
    const term = fakeTerm([lineFromSpec('a')]);
    expect(extractBlocksText(term, [])).toBe('');
  });

  it('single block — outputs its trimmed lines joined by \\n', () => {
    const term = fakeTerm([
      lineFromSpec('$ ls           '),
      lineFromSpec('a.txt b.txt    '),
      lineFromSpec('$              '),
    ]);
    expect(extractBlocksText(term, [fakeBlock(1, 0, 1)])).toBe('$ ls\na.txt b.txt');
  });

  it('multi block — id-ascending, single \\n between blocks, no decoration', () => {
    const term = fakeTerm([
      lineFromSpec('$ pwd     '),
      lineFromSpec('/tmp      '),
      lineFromSpec('$ whoami  '),
      lineFromSpec('linus     '),
    ]);
    const text = extractBlocksText(term, [
      fakeBlock(2, 2, 3),
      fakeBlock(1, 0, 1),
    ]);
    expect(text).toBe('$ pwd\n/tmp\n$ whoami\nlinus');
  });

  it('merges wrapped output within a block', () => {
    const term = fakeTerm([
      lineFromSpec('$ echo aaaa    '),
      lineFromSpec('aaaaaa'),
      lineFromSpec('bbbbbb', true),
    ]);
    expect(extractBlocksText(term, [fakeBlock(1, 0, 2)])).toBe('$ echo aaaa\naaaaaabbbbbb');
  });

  it('preserves CJK wide chars across blocks', () => {
    const term = fakeTerm([
      lineFromSpec('$ echo {w2}你{w2}好     '),
      lineFromSpec('{w2}你{w2}好           '),
    ]);
    expect(extractBlocksText(term, [fakeBlock(1, 0, 1)])).toBe('$ echo 你好\n你好');
  });
});

describe('resolveBlockLines (folded blocks)', () => {
  it('without foldStore: returns lines from buffer [start..end]', () => {
    const term = fakeTerm([
      lineFromSpec('$ ls'),
      lineFromSpec('a.txt'),
      lineFromSpec('b.txt'),
    ]);
    const lines = resolveBlockLines(term, fakeBlock(1, 0, 2));
    expect(lines).toHaveLength(3);
  });

  it('with foldStore: folded block returns prompt + savedLines', () => {
    const promptLine = lineFromSpec('$ npm install   ');
    const savedBody1 = lineFromSpec('added 234 packages');
    const savedBody2 = lineFromSpec('done in 3.2s');
    const term = fakeTerm([
      promptLine,
      lineFromSpec('$ ls'),
      lineFromSpec('a.txt'),
    ]);
    const block = {
      id: 7,
      color: '#abc',
      start: { line: 0, isDisposed: false },
      end: { line: 99, isDisposed: true },
    };
    const foldStore = {
      getFold: (id) =>
        id === 7 ? { savedLines: [savedBody1, savedBody2] } : undefined,
    };
    const lines = resolveBlockLines(term, block, foldStore);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(promptLine);
    expect(lines[1]).toBe(savedBody1);
    expect(lines[2]).toBe(savedBody2);
  });

  it('with foldStore but block not folded: falls back to buffer range', () => {
    const term = fakeTerm([
      lineFromSpec('$ ls'),
      lineFromSpec('a.txt'),
    ]);
    const foldStore = { getFold: () => undefined };
    const lines = resolveBlockLines(term, fakeBlock(1, 0, 1), foldStore);
    expect(lines).toHaveLength(2);
  });
});

describe('extractBlocksText with foldStore', () => {
  it('folded block: copies prompt + saved body, NOT cursorAbs fallback', () => {
    const term = fakeTerm([
      lineFromSpec('$ npm install     '),
      lineFromSpec('$ ls              '),
      lineFromSpec('a.txt b.txt       '),
    ]);
    const block = {
      id: 1,
      color: '#abc',
      start: { line: 0, isDisposed: false },
      end: { line: 99, isDisposed: true },
    };
    const foldStore = {
      getFold: (id) =>
        id === 1
          ? {
              savedLines: [
                lineFromSpec('added 234 packages'),
                lineFromSpec('done in 3.2s'),
              ],
            }
          : undefined,
    };
    const text = extractBlocksText(term, [block], foldStore);
    expect(text).toBe('$ npm install\nadded 234 packages\ndone in 3.2s');
    expect(text).not.toContain('ls');
    expect(text).not.toContain('a.txt');
  });
});
