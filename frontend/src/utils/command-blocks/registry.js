/**
 * Session-id → command-block tracker registry.
 * Host-driven WriteTerminal paths (QuickCommands, CommandHistory) never hit
 * term.onData, so they look up the tracker here and call feedInput('\r').
 */

const REGISTRY_KEY = '__luminCommandBlockTrackers';

function getRegistry() {
  if (typeof window === 'undefined') return null;
  if (!window[REGISTRY_KEY]) window[REGISTRY_KEY] = Object.create(null);
  return window[REGISTRY_KEY];
}

/** @param {string} sessionId @param {{feedInput:(data:string)=>void}|null} tracker */
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
