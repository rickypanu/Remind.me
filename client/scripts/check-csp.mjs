// Fails the build when an inline <script> in the built index.html is not allowed by the Content-Security-Policy
// in vercel.json. Without this, changing the theme script in index.html would silently break the whole app in
// production (the browser blocks the script and logs a CSP error).
//
//   node scripts/check-csp.mjs              checks dist/index.html (run after `vite build`, e.g. as "postbuild")
//   node scripts/check-csp.mjs index.html   checks another file
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const htmlPath = resolve(process.argv[2] ?? 'dist/index.html')
const html = readFileSync(htmlPath, 'utf8')
const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'))

const cspHeader = (config.headers ?? [])
  .flatMap((rule) => rule.headers ?? [])
  .find((header) => header.key.toLowerCase() === 'content-security-policy')
if (!cspHeader) {
  console.error('vercel.json has no Content-Security-Policy header.')
  process.exit(1)
}
const scriptSrc = cspHeader.value
  .split(';')
  .map((directive) => directive.trim())
  .find((directive) => directive.startsWith('script-src'))
if (!scriptSrc) {
  console.error('The CSP has no script-src directive.')
  process.exit(1)
}

const problems = []
let inlineCount = 0
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  const [, attributes, body] = match
  if (/\bsrc\s*=/.test(attributes)) continue // external files are allowed by 'self'
  if (/\btype\s*=\s*["']?(application\/(ld\+)?json|importmap|speculationrules)/i.test(attributes)) continue // data blocks do not execute
  if (!body.trim()) continue
  inlineCount += 1
  const hash = `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`
  if (!scriptSrc.includes(hash)) problems.push(`Inline script not allowed by the CSP. Add ${hash} to script-src in vercel.json.`)
}
if (/\son[a-z]+\s*=\s*["']/i.test(html)) problems.push('index.html contains an inline event-handler attribute (onclick=...), which the CSP blocks.')

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`CSP check passed: ${inlineCount} inline script(s), all covered by a hash in vercel.json.`)
