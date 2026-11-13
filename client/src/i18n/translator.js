/**
 * Translates the WHOLE page, not just selected strings: every piece of visible text and the placeholder / aria-label /
 * title / alt attributes are looked up in the chosen language's dictionary (English text is the key). A MutationObserver
 * keeps new content (route changes, toasts, dialogs, lists) translated, and switching language re-reads the English
 * originals, so you can move between languages and back to English without a reload.
 * Text a user typed (inputs, textareas, anything marked data-no-translate) is never touched.
 */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT", "SVG", "INPUT", "SELECT", "OPTION"]);
const ATTRS = ["placeholder", "aria-label", "title", "alt"];
const norm = (s) => s.replace(/\s+/g, " ").trim();

const textRec = new WeakMap(); // text node -> { src, out }
const attrRec = new WeakMap(); // element -> { [attr]: { src, out } }

let dict = null; // null = English (restore originals)
let observer = null;

/** True when the element (or a parent) opts out: user-typed content and the language picker itself. */
function optedOut(el) {
  for (let n = el; n; n = n.parentElement) {
    if (n.hasAttribute && (n.hasAttribute("data-no-translate") || n.getAttribute("contenteditable") === "true")) return true;
  }
  return false;
}

/** Text is skipped inside code, form fields and options as well. */
function skipped(el) {
  for (let n = el; n; n = n.parentElement) if (SKIP_TAGS.has(String(n.tagName).toUpperCase())) return true;
  return optedOut(el);
}

function convert(src) {
  if (!dict) return src;
  const core = norm(src);
  const hit = core && dict[core];
  if (!hit) return src;
  const lead = src.match(/^\s*/)[0];
  const trail = src.match(/\s*$/)[0];
  return lead + hit + trail;
}

function doText(node) {
  if (!node.parentElement || skipped(node.parentElement)) return;
  const rec = textRec.get(node);
  const cur = node.nodeValue;
  const src = rec && cur === rec.out ? rec.src : cur; // our own output, or fresh English from React
  const out = convert(src);
  if (out === cur) {
    if (rec && src === cur) textRec.delete(node);
    return;
  }
  textRec.set(node, { src, out });
  node.nodeValue = out;
}

function doAttrs(el) {
  if (optedOut(el)) return;
  let recs = attrRec.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    const rec = recs && recs[a];
    const src = rec && cur === rec.out ? rec.src : cur;
    const out = convert(src);
    if (out === cur) {
      if (rec && src === cur) delete recs[a];
      continue;
    }
    recs = recs || {};
    recs[a] = { src, out };
    attrRec.set(el, recs);
    el.setAttribute(a, out);
  }
}

function doTree(root) {
  if (root.nodeType === 3) return doText(root);
  if (root.nodeType !== 1) return;
  if (optedOut(root)) return;
  doAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === 3) doText(n);
    else doAttrs(n);
  }
}

function doTitle() {
  const t = document.querySelector("title");
  if (t && t.firstChild) doText(t.firstChild);
}

function onMutations(list) {
  observer.disconnect(); // our own writes must not trigger more work
  try {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach((n) => doTree(n));
      else if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttrs(m.target);
    }
  } finally {
    observe();
  }
}

function observe() {
  if (!observer) observer = new MutationObserver(onMutations);
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  const title = document.querySelector("title");
  if (title) observer.observe(title, { childList: true, characterData: true, subtree: true });
}

/** Switch the page to a dictionary (an object of English -> translation) or back to English (null / empty). */
export function applyDictionary(next) {
  dict = next && Object.keys(next).length ? next : null;
  if (observer) observer.disconnect();
  if (typeof document === "undefined" || !document.body) return;
  doTree(document.body);
  doTitle();
  observe();
}
