/** Loopback-only browser-test server using the build's existing Netlify policies. */
import { createServer } from 'node:http'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

const root = resolve(process.argv[2])
const port = Number(process.argv[3])
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Pass a build directory and port')
const rules = []
for (const line of readFileSync(resolve(root, '_headers'), 'utf8').split('\n')) {
  if (!line.trim() || line.trimStart().startsWith('#')) continue
  if (!/^\s/.test(line)) {
    const pattern = line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')
    rules.push({ pattern: new RegExp(`^${pattern}$`, 'i'), headers: {} })
  } else {
    const colon = line.indexOf(':')
    if (colon > 0) rules.at(-1).headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
  }
}
const mime = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
}
createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    let file = resolve(root, `.${pathname}`)
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Outside build')
    if (statSync(file).isDirectory()) file = resolve(file, 'index.html')
    const stat = statSync(file)
    if (!stat.isFile() || !['GET', 'HEAD'].includes(request.method)) throw new Error('Not served')
    // Netlify's more-specific rules replace values from earlier matching rules.
    const headers = Object.assign({}, ...rules.filter(rule => rule.pattern.test(pathname)).map(rule => rule.headers))
    response.writeHead(200, { ...headers, 'content-type': mime[extname(file)] || 'application/octet-stream', 'content-length': stat.size })
    if (request.method === 'HEAD') response.end()
    else createReadStream(file).pipe(response)
  } catch {
    response.writeHead(404).end()
  }
}).listen(port, '127.0.0.1')
