import { getSettings } from './settings';
import { vibrate } from './haptics';
import { playAlert, playUiSound } from './sounds';

/**
 * One call per moment, e.g. feedback.completed(). Each respects the two switches in Profile settings:
 *   "Enable Sound Effects"   -> in-app sounds
 *   "Enable Haptic Vibration" -> navigator.vibrate
 */
const sound = (name) => getSettings().soundEffects && playUiSound(name);

export const feedback = {
  added() {
    sound('added');
    vibrate(14);
  },
  updated() {
    sound('updated');
    vibrate(8);
  },
  completed() {
    sound('completed');
    vibrate([10, 45, 22]);
  },
  deleted() {
    sound('deleted');
    vibrate(12);
  },
  /** A push notification arrived while the app is open: play the chosen alert sound. */
  notification() {
    playAlert();
    vibrate([100, 50, 100]);
  },
};
