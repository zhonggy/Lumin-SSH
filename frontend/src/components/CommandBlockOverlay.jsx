import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clampMenuPosition } from '../utils/menuPosition.js';
import { extractBlocksText, renderBlocksToBlob, createPaintScheduler } from '../utils/command-blocks/index.js';
import { Z } from '../constants/zIndex';
import { useTranslation } from '../i18n.js';

const BAR_WIDTH = 12;
const BAR_TOP_OFFSET = 0;

/**
 * Command-block side bar overlay for an xterm Terminal.
 *
 * Owns painting, selection, tint, fold labels, and the block context menu.
 * Tracker / foldStore are owned by the parent so it can feedInput / unfoldAll.
 *
 * @param {{
 *   term: import('@xterm/xterm').Terminal | null,
 *   tracker: {blocks:ReadonlyArray<any>, onChange:(fn:()=>void)=>{dispose:()=>void}} | null,
 *   foldStore: {
 *     fold:(id:number)=>boolean,
 *     unfold:(id:number)=>boolean,
 *     isFolded:(id:number)=>boolean,
 *     getFold:(id:number)=>any,
 *     onChange:(fn:()=>void)=>{dispose:()=>void},
 *   } | null,
 *   containerEl: HTMLElement | null,
 *   enabled: boolean,
 *   autoColor: boolean,
 *   onSendToAi?: (text: string) => void,
 * }} props
 */
export default function CommandBlockOverlay({
  term,
  tracker,
  foldStore,
  containerEl,
  enabled,
  autoColor,
  onSendToAi,
}) {
  const { t } = useTranslation();
  const [paintTick, setPaintTick] = useState(0);
  const [isAltBuffer, setIsAltBuffer] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [coloredIds, setColoredIds] = useState(() => new Set());
  const [ctxMenu, setCtxMenu] = useState(null);
  const selectionAnchorRef = useRef(null);
  const autoColoredHwmRef = useRef(0);
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const coloredIdsRef = useRef(coloredIds);
  coloredIdsRef.current = coloredIds;

  const bumpPaint = useCallback(() => setPaintTick((n) => n + 1), []);

  // Paint scheduler + terminal event wiring
  useEffect(() => {
    if (!term || !tracker || !foldStore) return undefined;

    const scheduler = createPaintScheduler({
      shouldPaint: () => enabled && term.buffer.active.type !== 'alternate',
      paint: bumpPaint,
    });

    const disposables = [
      term.onScroll(() => scheduler.schedule()),
      term.onRender(() => scheduler.schedule()),
      term.buffer.onBufferChange((buf) => {
        setIsAltBuffer(buf.type === 'alternate');
        scheduler.schedule();
      }),
      tracker.onChange(() => {
        // Prune selection / tint when blocks are GC'd
        const live = new Set(tracker.blocks.map((b) => b.id));
        setSelectedIds((prev) => {
          if (prev.size === 0) return prev;
          let changed = false;
          const next = new Set();
          for (const id of prev) {
            if (live.has(id)) next.add(id);
            else changed = true;
          }
          return changed ? next : prev;
        });
        setColoredIds((prev) => {
          if (prev.size === 0) return prev;
          let changed = false;
          const next = new Set();
          for (const id of prev) {
            if (live.has(id)) next.add(id);
            else changed = true;
          }
          return changed ? next : prev;
        });
        if (selectionAnchorRef.current != null && !live.has(selectionAnchorRef.current)) {
          selectionAnchorRef.current = null;
        }
        // Auto-color new blocks
        if (autoColor) {
          setColoredIds((prev) => {
            let maxId = autoColoredHwmRef.current;
            const next = new Set(prev);
            let changed = false;
            for (const b of tracker.blocks) {
              if (b.id > autoColoredHwmRef.current) {
                if (!next.has(b.id)) {
                  next.add(b.id);
                  changed = true;
                }
              }
              if (b.id > maxId) maxId = b.id;
            }
            autoColoredHwmRef.current = maxId;
            return changed ? next : prev;
          });
        }
        scheduler.schedule();
      }),
      foldStore.onChange(() => scheduler.schedule()),
    ];

    setIsAltBuffer(term.buffer.active.type === 'alternate');
    scheduler.schedule();

    return () => {
      disposables.forEach((d) => d.dispose());
      scheduler.dispose();
    };
  }, [term, tracker, foldStore, enabled, autoColor, bumpPaint]);

  // When autoColor is turned on mid-session, color existing blocks above hwm
  useEffect(() => {
    if (!autoColor || !tracker) return;
    setColoredIds((prev) => {
      let maxId = autoColoredHwmRef.current;
      const next = new Set(prev);
      let changed = false;
      for (const b of tracker.blocks) {
        if (b.id > autoColoredHwmRef.current) {
          if (!next.has(b.id)) {
            next.add(b.id);
            changed = true;
          }
        }
        if (b.id > maxId) maxId = b.id;
      }
      autoColoredHwmRef.current = maxId;
      return changed ? next : prev;
    });
  }, [autoColor, tracker, paintTick]);

  // Left padding for the bar
  useEffect(() => {
    if (!containerEl) return undefined;
    const xtermEl = containerEl.querySelector('.xterm');
    if (!xtermEl) return undefined;
    if (enabled) {
      xtermEl.style.paddingLeft = `${BAR_WIDTH}px`;
    } else {
      xtermEl.style.paddingLeft = '';
    }
    return () => {
      xtermEl.style.paddingLeft = '';
    };
  }, [containerEl, enabled, paintTick]);

  // Clear selection on outside click / Esc
  useEffect(() => {
    if (selectedIds.size === 0) return undefined;
    const onMouseDown = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.cmd-block-hit') || t.closest('.cmd-block-menu')) return;
      setSelectedIds(new Set());
      selectionAnchorRef.current = null;
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedIds(new Set());
        selectionAnchorRef.current = null;
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedIds.size]);

  // Close context menu on outside mousedown
  useEffect(() => {
    if (!ctxMenu) return undefined;
    const handler = (e) => {
      const t = e.target;
      if (t instanceof Element && t.closest('.cmd-block-menu')) return;
      setCtxMenu(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  const blockRects = useMemo(() => {
    // paintTick is the dependency that forces recompute on scroll/render
    void paintTick;
    if (!enabled || !term || !tracker || !containerEl || isAltBuffer) return [];
    const firstRow = containerEl.querySelector('.xterm-rows')?.firstElementChild;
    const rowHeight = firstRow?.offsetHeight ?? 0;
    if (!rowHeight) return [];
    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const rows = term.rows;
    const cursorAbs = buf.baseY + buf.cursorY;
    const out = [];
    for (const b of tracker.blocks) {
      if (b.start.isDisposed) continue;
      const folded = foldStore?.isFolded(b.id) ?? false;
      const startLine = b.start.line;
      const endLine = folded
        ? b.start.line
        : b.end && !b.end.isDisposed
          ? b.end.line
          : cursorAbs;
      const top = Math.max(startLine, viewportY);
      const bot = Math.min(endLine, viewportY + rows - 1);
      if (top > bot) continue;
      const fold = folded ? foldStore?.getFold(b.id) : undefined;
      out.push({
        id: b.id,
        y: (top - viewportY) * rowHeight + BAR_TOP_OFFSET,
        h: (bot - top + 1) * rowHeight,
        color: b.color,
        startLine,
        endLine,
        folded,
        foldCount: fold?.count ?? 0,
      });
    }
    return out;
  }, [paintTick, enabled, term, tracker, foldStore, containerEl, isAltBuffer]);

  const singleSelect = useCallback((r) => {
    setSelectedIds(new Set([r.id]));
    selectionAnchorRef.current = r.id;
    term?.selectLines(r.startLine, r.endLine);
  }, [term]);

  const toggleSelect = useCallback((r) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(r.id)) next.delete(r.id);
      else next.add(r.id);
      return next;
    });
    selectionAnchorRef.current = r.id;
  }, []);

  const rangeSelectTo = useCallback((r) => {
    if (selectionAnchorRef.current == null || !tracker) {
      singleSelect(r);
      return;
    }
    const lo = Math.min(selectionAnchorRef.current, r.id);
    const hi = Math.max(selectionAnchorRef.current, r.id);
    const next = new Set();
    for (const b of tracker.blocks) {
      if (b.id >= lo && b.id <= hi) next.add(b.id);
    }
    setSelectedIds(next);
  }, [tracker, singleSelect]);

  const handleBlockClick = useCallback((r, ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.shiftKey) rangeSelectTo(r);
    else if (ev.metaKey || ev.ctrlKey) toggleSelect(r);
    else singleSelect(r);
  }, [rangeSelectTo, toggleSelect, singleSelect]);

  const clearBlockSelection = useCallback(() => {
    setSelectedIds(new Set());
    selectionAnchorRef.current = null;
  }, []);

  const copyTargetBlocks = useCallback((rightClickedId) => {
    if (!tracker) return [];
    const selected = selectedIdsRef.current;
    const ids = selected.has(rightClickedId) ? new Set(selected) : new Set([rightClickedId]);
    return tracker.blocks.filter((b) => ids.has(b.id));
  }, [tracker]);

  const copyBlocksAsText = useCallback(async (blocks) => {
    if (!term || blocks.length === 0) return;
    const text = extractBlocksText(term, blocks, foldStore);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.warn('copy block text failed:', e);
    }
    clearBlockSelection();
  }, [term, foldStore, clearBlockSelection]);

  const copyBlocksAsImage = useCallback((blocks) => {
    if (!term || blocks.length === 0) return;
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      console.warn('copy image: ClipboardItem / clipboard.write unavailable');
      return;
    }
    try {
      const pngPromise = renderBlocksToBlob(term, blocks, {}, foldStore).then((b) => {
        if (!b) throw new Error('render produced no blob');
        return b;
      });
      navigator.clipboard
        .write([new ClipboardItem({ 'image/png': pngPromise })])
        .then(() => clearBlockSelection())
        .catch((e) => console.warn('copy image failed:', e));
    } catch (e) {
      console.warn('copy image failed (sync):', e);
    }
  }, [term, foldStore, clearBlockSelection]);

  const sendBlocksToAi = useCallback((blocks) => {
    if (!term || blocks.length === 0 || !onSendToAi) return;
    const text = extractBlocksText(term, blocks, foldStore);
    if (!text) return;
    onSendToAi(text);
    clearBlockSelection();
  }, [term, foldStore, onSendToAi, clearBlockSelection]);

  const openBlockMenu = useCallback((r, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!foldStore || !tracker) return;
    const folded = r.folded;
    const block = tracker.blocks.find((b) => b.id === r.id);
    const canFold = !!block && !!block.end && !block.end.isDisposed
      && block.start.line + 1 <= block.end.line;
    const targets = copyTargetBlocks(r.id);
    const n = targets.length;
    const colored = coloredIdsRef.current.has(r.id);
    const pos = clampMenuPosition(e.clientX, e.clientY, 200, 200);

    setCtxMenu({
      x: pos.x,
      y: pos.y,
      items: [
        {
          label: folded ? t('展开命令块') : t('折叠命令块'),
          disabled: !folded && !canFold,
          action: () => {
            if (folded) foldStore.unfold(r.id);
            else foldStore.fold(r.id);
          },
        },
        {
          label: colored ? t('取消染色') : t('染色'),
          action: () => {
            setColoredIds((prev) => {
              const next = new Set(prev);
              if (next.has(r.id)) next.delete(r.id);
              else next.add(r.id);
              return next;
            });
          },
        },
        {
          label: n > 1 ? t('复制为文本 ({n})').replace('{n}', String(n)) : t('复制为文本'),
          disabled: n === 0,
          action: () => copyBlocksAsText(targets),
        },
        {
          label: n > 1 ? t('复制为图片 ({n})').replace('{n}', String(n)) : t('复制为图片'),
          disabled: n === 0,
          action: () => copyBlocksAsImage(targets),
        },
        ...(onSendToAi
          ? [{
              label: n > 1 ? t('发送到 AI ({n})').replace('{n}', String(n)) : t('发送到 AI'),
              disabled: n === 0,
              action: () => sendBlocksToAi(targets),
            }]
          : []),
      ],
    });
  }, [foldStore, tracker, copyTargetBlocks, copyBlocksAsText, copyBlocksAsImage, sendBlocksToAi, onSendToAi, t]);

  if (!enabled || !term || !tracker) return null;

  return (
    <>
      {/* Tint layer */}
      {blockRects.map((r) => (
        coloredIds.has(r.id) ? (
          <div
            key={`tint-${r.id}`}
            className="cmd-block-tint"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: r.y,
              height: r.h,
              background: r.color,
              opacity: 0.15,
              borderRadius: 2,
              pointerEvents: 'none',
              zIndex: Z.CONTENT,
            }}
          />
        ) : null
      ))}

      {/* Side bar SVG */}
      <svg
        className="cmd-block-bar"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: BAR_WIDTH,
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: Z.STACK,
        }}
      >
        {isAltBuffer ? (
          <rect x="5" y="0" width="3" height="100%" rx="1.5" fill="var(--text-tertiary)" opacity="0.5" />
        ) : (
          blockRects.map((r) => (
            <g key={r.id}>
              {selectedIds.has(r.id) && (
                <rect
                  x="2"
                  y={r.y - 2}
                  width="9"
                  height={r.h + 4}
                  rx="3"
                  fill={r.color}
                  opacity="0.45"
                  style={{ filter: 'blur(2px)', pointerEvents: 'none' }}
                />
              )}
              {r.folded ? (
                <rect
                  x="5"
                  y={r.y}
                  width="3"
                  height={r.h}
                  rx="1.5"
                  fill="none"
                  stroke={r.color}
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
              ) : (
                <rect x="5" y={r.y} width="3" height={r.h} rx="1.5" fill={r.color} />
              )}
              <rect
                className="cmd-block-hit"
                x="0"
                y={r.y}
                width={BAR_WIDTH}
                height={r.h}
                fill="transparent"
                style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                onClick={(e) => handleBlockClick(r, e)}
                onContextMenu={(e) => openBlockMenu(r, e)}
              />
            </g>
          ))
        )}
      </svg>

      {/* Fold labels */}
      {blockRects.map((r) => (
        r.folded ? (
          <div
            key={`fold-${r.id}`}
            style={{
              position: 'absolute',
              right: 8,
              top: r.y,
              fontSize: 11,
              lineHeight: 1.4,
              padding: '0 6px',
              color: 'var(--text-tertiary)',
              background: 'var(--surface-raised)',
              borderRadius: 3,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              opacity: 0.85,
              zIndex: Z.STACK,
            }}
          >
            ⋯ {r.foldCount} {r.foldCount === 1 ? t('行') : t('行')}
          </div>
        ) : null
      ))}

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="cmd-block-menu"
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: Z.MENU,
            minWidth: 160,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm, 6px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
            padding: '4px 0',
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ctxMenu.items.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setCtxMenu(null);
                if (!item.disabled) item.action();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '7px 14px',
                border: 'none',
                background: 'transparent',
                color: item.disabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
                cursor: item.disabled ? 'default' : 'pointer',
                fontSize: 12,
                opacity: item.disabled ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) e.currentTarget.style.background = 'var(--surface-overlay)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
