/** Per-device "look" choices: font, card style and density. Saved in localStorage, applied as data attributes on <html>.
 *  Keep the keys and ids in sync with the inline script in index.html and the [data-font] / [data-cards] / [data-density] rules in design.css. */
export const LOOK_OPTIONS = {
  font: {
    label: "Font",
    items: [
      { id: "brand", label: "GetRemindMe", hint: "Bricolage + Instrument" },
      { id: "clean", label: "Clean", hint: "Schibsted Grotesk" },
      { id: "system", label: "System", hint: "Your device font" },
      { id: "serif", label: "Editorial", hint: "Serif headings" },
    ],
  },
  cards: {
    label: "Cards",
    items: [
      { id: "solid", label: "Solid", hint: "Hard border and offset shadow" },
      { id: "soft", label: "Soft", hint: "Light border, gentle shadow" },
      { id: "flat", label: "Flat", hint: "Border only" },
    ],
  },
  density: {
    label: "Spacing",
    items: [
      { id: "cozy", label: "Cozy", hint: "Roomy" },
      { id: "compact", label: "Compact", hint: "More on screen" },
    ],
  },
};
export const LOOK_DEFAULTS = { font: "brand", cards: "solid", density: "cozy" };
const key = (name) => `remindme-look-${name}`;

export function readLook() {
  const out = {};
  for (const [name, { items }] of Object.entries(LOOK_OPTIONS)) {
    let saved = null;
    try {
      saved = localStorage.getItem(key(name));
    } catch {
      /* private mode: defaults */
    }
    out[name] = items.some((i) => i.id === saved) ? saved : LOOK_DEFAULTS[name];
  }
  return out;
}

export function applyLook(look = readLook()) {
  for (const [name, value] of Object.entries(look)) document.documentElement.setAttribute(`data-${name}`, value);
}

export function saveLook(name, value) {
  try {
    localStorage.setItem(key(name), value);
  } catch {
    /* the choice still applies for this visit */
  }
  applyLook({ ...readLook(), [name]: value });
}
