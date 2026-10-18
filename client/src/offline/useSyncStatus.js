import { useSyncExternalStore } from 'react';
import { getSyncState, subscribeSync } from './sync';

/** { online, syncing, pending, lastResult } - re-renders when any of them change. */
export default function useSyncStatus() {
  return useSyncExternalStore(subscribeSync, getSyncState, getSyncState);
}
