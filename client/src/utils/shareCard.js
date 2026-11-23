/**
 * The "share my streak" picture: a 1080x1350 PNG drawn on a canvas (nothing is uploaded anywhere).
 * Shared through the phone's share sheet when it can send files, otherwise downloaded.
 */
const W = 1080;
const H = 1350;
const FONT = '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif';

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function flame(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = "#f4b400";
  ctx.beginPath();
  ctx.moveTo(0, -100);
  ctx.bezierCurveTo(30, -60, 80, -30, 80, 25);
  ctx.bezierCurveTo(80, 75, 42, 105, 0, 105);
  ctx.bezierCurveTo(-42, 105, -80, 75, -80, 25);
  ctx.bezierCurveTo(-80, -5, -62, -30, -40, -45);
  ctx.bezierCurveTo(-38, -20, -25, -8, -12, -8);
  ctx.bezierCurveTo(-26, -50, -10, -80, 0, -100);
  ctx.fill();
  ctx.fillStyle = "#ff6b4a";
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.bezierCurveTo(20, 5, 42, 20, 42, 52);
  ctx.bezierCurveTo(42, 78, 22, 92, 0, 92);
  ctx.bezierCurveTo(-22, 92, -42, 78, -42, 52);
  ctx.bezierCurveTo(-42, 32, -28, 18, 0, -20);
  ctx.fill();
  ctx.restore();
}

/** Draws the card. `stats` = { streak, best_streak, completed_today }, `name` = who it belongs to. */
export function drawShareCard(canvas, { name, streak = 0, best = 0, doneToday = 0 }) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f6f2e9";
  ctx.fillRect(0, 0, W, H);

  // Card: flat ultramarine panel with a hard offset shadow, like the site.
  ctx.fillStyle = "#14161f";
  rounded(ctx, 96, 176, 888, 1000, 48);
  ctx.fill();
  ctx.fillStyle = "#0f7f78";
  ctx.strokeStyle = "#14161f";
  ctx.lineWidth = 6;
  rounded(ctx, 80, 160, 888, 1000, 48);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f6f2e9";
  ctx.textAlign = "center";
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(name ? `${name}'s streak` : "My streak", W / 2 - 16, 270);

  flame(ctx, W / 2 - 16, 470, 1.35);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 260px ${FONT}`;
  ctx.fillText(String(streak), W / 2 - 16, 800);
  ctx.font = `600 52px ${FONT}`;
  ctx.fillStyle = "#c9d3ff";
  ctx.fillText(streak === 1 ? "day in a row" : "days in a row", W / 2 - 16, 880);

  // Two small stats
  const box = (x, label, value) => {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    rounded(ctx, x, 950, 360, 150, 28);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText(String(value), x + 180, 1030);
    ctx.fillStyle = "#c9d3ff";
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(label, x + 180, 1076);
  };
  box(160, "best streak", best);
  box(560, "done today", doneToday);

  ctx.fillStyle = "#14161f";
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText("GetRemindMe", W / 2, 1262);
  ctx.fillStyle = "#77736a";
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText("Reminders that actually ring", W / 2, 1310);
}

/** Make the picture and share it. Returns "shared" | "downloaded" | "failed". */
export async function shareStreakCard(data) {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const canvas = document.createElement("canvas");
    drawShareCard(canvas, data);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return "failed";
    const file = new File([blob], "getremindme-streak.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My GetRemindMe streak" });
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") return "failed";
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "getremindme-streak.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  } catch {
    return "failed";
  }
}
