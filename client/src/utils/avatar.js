/** Turns the avatar URL the API stores into something an <img> can load ("/uploads/..." lives on the API host). */
export function resolveAvatarSrc(url) {
  if (!url) return null;
  if (url.startsWith("/uploads")) {
    const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
    return `${base}${url}`;
  }
  return url;
}
