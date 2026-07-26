/**
 * Session-id → command-block tracker registry.
 *
 * Host-driven write paths (command bar, quick commands, history re-run) never
 * hit term.onData, so they look up the tracker here and call feedInput('\r').
 *
 * Global key is namespaced so multiple apps / copies of this package on one
 * page don't stomp each other.
 */

const REGISTRY_KEY = '__xtermCommandBlockTrackers';

function getRegistry() {
  if (typeof globalThis === 'undefined') return null;
  if (!globalThis[REGISTRY_KEY]) globalThis[REGISTRY_KEY] = Object.create(null);
  return globalThis[REGISTRY_KEY];
}

/**
 * @param {string} sessionId
 * @param {{feedInput:(data:string)=>void}|null} tracker
 */
export function registerCommandBlockTracker(sessionId, tracker) {
  const reg = getRegistry();
  if (!reg || !sessionId) return;
  if (tracker) reg[sessionId] = tracker;
  else delete reg[sessionId];
}

/**
 * Notify the tracker that a host path is about to send Enter.
 * No-op if no tracker is registered (feature off / terminal not mounted).
 * @param {string} sessionId
 * @param {string} [payload] data that will be written — only feeds when it contains \r
 */
export function feedCommandBlockInput(sessionId, payload = '\r') {
  const reg = getRegistry();
  const tracker = reg?.[sessionId];
  if (!tracker?.feedInput) return;
  if (typeof payload === 'string' && payload.includes('\r')) {
    tracker.feedInput(payload);
  }
}
