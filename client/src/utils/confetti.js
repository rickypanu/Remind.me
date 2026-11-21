/**
 * A short confetti burst on a throwaway canvas (no library). Skipped for people who asked for reduced motion.
 *   confetti({ x, y })              small burst from a point (a ticked reminder)
 *   confetti({ big: true })         the whole list is done
 */
const COLORS = ["#2a47d9", "#f4b400", "#ff6b4a", "#19b394", "#8b5cf6", "#14161f"];

export default function confetti({ x, y, big = false } = {}) {
  if (typeof document === "undefined") return;
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  } catch {
    /* matchMedia unavailable: carry on */
  }
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "2147483000" });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = x ?? w / 2;
  const oy = y ?? (big ? h * 0.3 : h * 0.6);
  const count = big ? 140 : 48;
  const pieces = Array.from({ length: count }, () => {
    const angle = big ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const speed = (big ? 6 : 8) + Math.random() * (big ? 8 : 6);
    return {
      x: ox, y: oy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (big ? 4 : 0),
      size: 5 + Math.random() * 6, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      color: COLORS[(Math.random() * COLORS.length) | 0], round: Math.random() < 0.3,
    };
  });

  const started = performance.now();
  const life = big ? 2600 : 1500;
  const frame = (now) => {
    const t = now - started;
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - life * 0.6) / (life * 0.4));
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, 6.28);
        ctx.fill();
      } else ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < life) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
