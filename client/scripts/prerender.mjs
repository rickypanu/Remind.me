// Build step that runs right after `vite build` (finding X1/X2): writes static, crawler-readable HTML for every
// public page plus sitemap.xml and robots.txt. No browser, no extra dependency.
//
// What a crawler or a link preview gets for /about: the real <title>, description, canonical URL, Open Graph card
// and structured data, in the first bytes of the HTML. The page body is still the React app (it renders in the
// browser exactly as before), so this changes what bots read, not how users experience the site.
//
//   dist/index.html            "/" with the home page metadata
//   dist/about/index.html ...  the other public pages
//   dist/app-shell.html        neutral NOINDEX shell: served for /dashboard, /profile ... and unknown URLs
//   dist/sitemap.xml, dist/robots.txt
//
// Usage: VITE_SITE_URL=https://your-domain node scripts/prerender.mjs [distDir]
// (On Vercel, VITE_SITE_URL may be left unset: VERCEL_PROJECT_PRODUCTION_URL is used.)
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PUBLIC_ROUTES } from "../src/seo/routes.js";
import { applySeoBlock, buildRobots, buildSeoBlock, buildSitemap, fileForPath, normalizeSiteUrl } from "./seo.mjs";

async function main() {
  const dist = resolve(process.argv[2] || "dist");
  // Vercel (free Hobby) exposes the production hostname without a scheme; use it when no custom domain is set.
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  let rawSiteUrl = process.env.VITE_SITE_URL || process.env.SITE_URL || (vercelHost ? `https://${vercelHost}` : undefined);
  if (!rawSiteUrl && !process.env.VERCEL && !process.env.CI) {
    // Building on your own computer: canonical links only matter for crawlers, so do not make the build fail.
    rawSiteUrl = "http://localhost:4173";
    console.warn("VITE_SITE_URL is not set: using http://localhost:4173 for canonical links. Set it for a real deploy.");
  }
  const siteUrl = normalizeSiteUrl(rawSiteUrl);
  const base = await readFile(join(dist, "index.html"), "utf8");

  // The untouched shell (noindex) first: private routes fall back to it (see vercel.json).
  applySeoBlock(base, "<!-- seo:start --><!-- seo:end -->"); // validates the markers
  await writeFile(join(dist, "app-shell.html"), base);

  const written = [];
  for (const path of Object.keys(PUBLIC_ROUTES)) {
    const html = applySeoBlock(base, buildSeoBlock(path, siteUrl));
    const target = join(dist, fileForPath(path));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, html);
    written.push(fileForPath(path));
  }
  await writeFile(join(dist, "sitemap.xml"), buildSitemap(siteUrl));
  await writeFile(join(dist, "robots.txt"), buildRobots(siteUrl));

  console.log(`Prerendered ${written.length} pages for ${siteUrl}: ${written.join(", ")}`);
}

main().catch((error) => {
  console.error(`prerender failed: ${error.message}`);
  process.exit(1);
});
