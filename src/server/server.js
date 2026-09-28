import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
};
export const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store',
};

/** Only the build directory is public. Resolve symlinks before reading files. */
export function createAppServer({
  root = fileURLToPath(new URL('../../dist/', import.meta.url)),
} = {}) {
  return http.createServer(
    { requestTimeout: 10_000, headersTimeout: 5_000, maxHeaderSize: 8_192 },
    async (req, res) => {
      const respond = (status, message, headers = {}) => {
        res.writeHead(status, {
          ...securityHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          ...headers,
        });
        res.end(req.method === 'HEAD' ? undefined : message);
      };
      if (!['GET', 'HEAD'].includes(req.method))
        return respond(405, 'Method not allowed', { Allow: 'GET, HEAD' });
      let pathname;
      try {
        // Check before URL normalization so literal and encoded traversal are rejected.
        pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
        if (
          !pathname.startsWith('/') ||
          /[\\\0]/u.test(pathname) ||
          pathname.split('/').some((part) => part.startsWith('.'))
        )
          return respond(403, 'Forbidden');
      } catch {
        return respond(400, 'Bad request');
      }
      if (pathname === '/') pathname = '/index.html';
      if (!Object.hasOwn(types, extname(pathname))) return respond(404, 'Not found');
      try {
        const realRoot = await realpath(root);
        const target = await realpath(resolve(realRoot, `.${pathname}`));
        if (!target.startsWith(realRoot + sep)) return respond(403, 'Forbidden');
        const data = await readFile(target);
        respond(200, data, {
          'Content-Type': types[extname(target)] ?? 'application/octet-stream',
          'Content-Length': data.length,
        });
      } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) return respond(404, 'Not found');
        respond(500, 'Internal server error');
      }
    },
  );
}
