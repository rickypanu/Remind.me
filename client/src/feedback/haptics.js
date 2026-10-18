import { getSettings } from './settings';

/** True where navigator.vibrate exists (Android Chrome/Firefox). iOS Safari does not implement it. */
export const hapticsSupported = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export function vibrate(pattern) {
  if (!getSettings().haptics || !hapticsSupported()) return false;
  try {
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}
