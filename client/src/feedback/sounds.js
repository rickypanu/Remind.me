import { deleteFile, getFile, saveFile } from '../offline/db';
import { getSettings, updateSettings } from './settings';

/**
 * Every sound is synthesised with the Web Audio API: no audio files to download or cache, so
 * they work offline and add nothing to the bundle. The only stored audio is the user's own upload.
 */
let ctx = null;
function audio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** Browsers only allow audio after a tap/keypress: unlock the context on the first one. */
export function installAudioUnlock() {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function playNotes(notes, volume = 1) {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.01;
  for (const n of notes) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    const start = t0 + (n.at || 0);
    osc.type = n.type || 'sine';
    osc.frequency.setValueAtTime(n.freq, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.dur);
    const peak = (n.gain ?? 0.08) * volume;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

// Short, quiet UI sounds
const UI = {
  added: [{ freq: 587, dur: 0.11 }, { freq: 880, at: 0.08, dur: 0.16 }],
  updated: [{ freq: 700, dur: 0.09, type: 'triangle', gain: 0.06 }],
  completed: [
    { freq: 523, dur: 0.16 },
    { freq: 659, at: 0.07, dur: 0.16 },
    { freq: 784, at: 0.14, dur: 0.16 },
    { freq: 1047, at: 0.21, dur: 0.26 },
  ],
  deleted: [{ freq: 330, to: 200, dur: 0.14, type: 'triangle', gain: 0.07 }],
};
export function playUiSound(name) {
  if (UI[name]) playNotes(UI[name]);
}

// Notification sounds (longer and a little louder)
const A = 0.2;
export const ALERT_OPTIONS = [
  { id: 'system', label: 'System default', hint: 'Your device’s own notification sound' },
  { id: 'chime', label: 'Chime', hint: 'Two soft rising tones', notes: [{ freq: 880, dur: 0.6, gain: A }, { freq: 1175, at: 0.18, dur: 0.8, gain: A }] },
  { id: 'bell', label: 'Bell', hint: 'A clear double strike', notes: [{ freq: 660, dur: 1.1, gain: A }, { freq: 1320, dur: 0.7, gain: A * 0.4 }, { freq: 660, at: 0.5, dur: 1, gain: A * 0.8 }] },
  { id: 'pulse', label: 'Pulse', hint: 'Three quick beeps', notes: [0, 0.22, 0.44].map((at) => ({ freq: 740, at, dur: 0.15, gain: A * 0.8 })) },
  { id: 'ripple', label: 'Ripple', hint: 'A gentle upward run', notes: [523, 659, 784, 988, 1175].map((freq, i) => ({ freq, at: i * 0.1, dur: 0.35, gain: A * 0.8 })) },
  { id: 'marimba', label: 'Marimba', hint: 'Warm wooden notes', notes: [392, 523, 659].map((freq, i) => ({ freq, at: i * 0.14, dur: 0.4, type: 'triangle', gain: A })) },
];

// ---- the user's own sound ----------------------------------------------------------------------
export const CUSTOM_KEY = 'customAlert';
export const MAX_CUSTOM_BYTES = 2 * 1024 * 1024;
const MAX_CUSTOM_SECONDS = 30;
let customAudio = null;

export function stopAlert() {
  if (customAudio) {
    customAudio.pause();
    customAudio = null;
  }
}

async function playCustom() {
  const blob = await getFile(CUSTOM_KEY);
  if (!blob) return false;
  stopAlert();
  const url = URL.createObjectURL(blob);
  const el = new Audio(url);
  customAudio = el;
  el.onended = el.onerror = () => URL.revokeObjectURL(url);
  try {
    await el.play();
    setTimeout(() => el === customAudio && stopAlert(), 15000); // never longer than 15 s
    return true;
  } catch {
    URL.revokeObjectURL(url);
    return false;
  }
}

/** Plays a notification sound. Returns false for "system" (the OS plays its own). */
export async function playAlert(id = getSettings().alertSound) {
  if (id === 'system') return false;
  if (id === 'custom') return playCustom();
  const option = ALERT_OPTIONS.find((o) => o.id === id);
  if (!option?.notes) return false;
  playNotes(option.notes);
  return true;
}

export async function saveCustomSound(file) {
  const typeOk = /^audio\/(mpeg|mp3|wav|x-wav|wave|vnd\.wave)$/.test(file.type) || /\.(mp3|wav)$/i.test(file.name);
  if (!typeOk) return { ok: false, error: 'Please choose an .mp3 or .wav file.' };
  if (file.size > MAX_CUSTOM_BYTES) return { ok: false, error: 'That file is too large. Keep it under 2 MB.' };

  const url = URL.createObjectURL(file);
  const duration = await new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.onloadedmetadata = () => resolve(probe.duration);
    probe.onerror = () => resolve(NaN);
    probe.src = url;
  });
  URL.revokeObjectURL(url);
  if (!Number.isFinite(duration)) return { ok: false, error: 'That audio file could not be read.' };
  if (duration > MAX_CUSTOM_SECONDS) return { ok: false, error: `Keep the sound under ${MAX_CUSTOM_SECONDS} seconds.` };

  await saveFile(CUSTOM_KEY, file);
  updateSettings({ alertSound: 'custom', customSoundName: file.name });
  return { ok: true };
}

export async function removeCustomSound() {
  await deleteFile(CUSTOM_KEY);
  const { alertSound } = getSettings();
  updateSettings({ customSoundName: '', alertSound: alertSound === 'custom' ? 'system' : alertSound });
}
