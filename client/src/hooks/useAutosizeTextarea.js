import { useCallback, useEffect, useLayoutEffect } from "react";

/**
 * Height of a textarea showing ONE line: line height + vertical padding + vertical border.
 * `style` is a CSSStyleDeclaration (or any object with the same pixel strings), so this is testable without a browser.
 */
export function singleLineHeight(style) {
  const px = (value) => Number.parseFloat(value) || 0;
  const line = px(style.lineHeight) || px(style.fontSize) * 1.5 || 24;
  return Math.ceil(
    line + px(style.paddingTop) + px(style.paddingBottom) + px(style.borderTopWidth) + px(style.borderBottomWidth)
  );
}

/**
 * Makes a textarea grow with its content (up to `maxViewportRatio` of the window height, then it scrolls).
 * While it is EMPTY it stays a clean single line: browsers include a wrapped placeholder in `scrollHeight`, which
 * used to make an empty Quick Add box three lines tall.
 */
export default function useAutosizeTextarea(ref, value, maxViewportRatio = 0.45) {
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (!value) {
      el.style.height = `${singleLineHeight(getComputedStyle(el))}px`;
      el.style.overflowY = "hidden";
      return;
    }
    el.style.height = "auto";
    const max = Math.round(window.innerHeight * maxViewportRatio);
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [ref, value, maxViewportRatio]);

  useLayoutEffect(fit, [fit]);
  useEffect(() => {
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [fit]);
}
