/**
 * Coalesce high-frequency terminal events into at most one paint per frame.
 *
 * @param {{
 *   shouldPaint: () => boolean,
 *   paint: () => void,
 *   requestFrame?: (cb: FrameRequestCallback) => number,
 *   cancelFrame?: (handle: number) => void,
 * }} opts
 */
export function createPaintScheduler(opts) {
  const requestFrame = opts.requestFrame ?? ((cb) => requestAnimationFrame(cb));
  const cancelFrame = opts.cancelFrame ?? ((handle) => cancelAnimationFrame(handle));
  let frame = null;
  let disposed = false;

  return {
    schedule() {
      if (disposed || frame !== null || !opts.shouldPaint()) return;
      frame = requestFrame(() => {
        frame = null;
        if (!disposed && opts.shouldPaint()) opts.paint();
      });
    },
    dispose() {
      disposed = true;
      if (frame !== null) {
        cancelFrame(frame);
        frame = null;
      }
    },
  };
}
