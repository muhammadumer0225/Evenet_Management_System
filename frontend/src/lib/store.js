/**
 * Tiny reactive store persisted in localStorage.
 * It plays the role of the MongoDB/Express backend so the frontend runs standalone.
 * - `useStore()` re-renders on every change (also across browser tabs → "real-time" updates).
 * - Replace the functions in `api.js` with axios calls to your Express API when the backend is ready.
 */
import { useSyncExternalStore } from 'react';
import { buildSeed, VERSION } from './seed';

const KEY = 'eventsphere.db';
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.version === VERSION) return s;
    }
  } catch {
    /* ignore */
  }
  return buildSeed();
}

let state = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / blocked: keep in memory */
  }
}
function emit() {
  listeners.forEach((l) => l());
}

export const getState = () => state;

export function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Immutable-style update: mutate a deep clone, then publish. */
export function mutate(fn) {
  const draft = structuredClone(state);
  const result = fn(draft);
  state = draft;
  persist();
  emit();
  return result;
}

export function resetDemoData() {
  state = buildSeed();
  persist();
  emit();
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState);
}

// Cross-tab sync: another tab changed the DB → update here instantly.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue);
        emit();
      } catch {
        /* ignore */
      }
    }
  });
}
