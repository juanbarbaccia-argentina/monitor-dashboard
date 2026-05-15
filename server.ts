import { readFileSync } from 'fs';
import { join } from 'path';

const PASSWORD    = process.env.DASHBOARD_PASSWORD || 'Picasso2026';
const RELOAD_TOK  = process.env.RELOAD_TOKEN       || 'Picasso2026';

const sessions  = new Set<string>();
let storedData: unknown = null;

function token() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

const HTML = readFileSync(join(import.meta.dir, 'index.html'), 'utf8');
const JS   = readFileSync(join(import.meta.dir, 'static/js/dashboard.js'), 'utf8');

function sessionOf(req: Request): string | null {
  const m = (req.headers.get('Cookie') || '').match(/session=([^;]+)/);
  return m ? m[1] : null;
}

Bun.serve({
  port: Number(process.env.PORT) || 3000,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname === '/static/js/dashboard.js') {
      return new Response(JS, {
        headers: { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' }
      });
    }

    if (pathname.startsWith('/static/')) {
      const ext = pathname.split('.').pop() || '';
      const mime: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', geojson: 'application/geo+json', json: 'application/json' };
      const file = Bun.file(join(import.meta.dir, pathname));
      if (await file.exists())
        return new Response(file, { headers: { 'Content-Type': mime[ext] || 'application/octet-stream', 'Cache-Control': 'max-age=86400' } });
    }

    if (pathname === '/api/reload' && req.method === 'POST') {
      if ((req.headers.get('Authorization') || '') !== `Bearer ${RELOAD_TOK}`)
        return new Response('Unauthorized', { status: 401 });
      storedData = await req.json();
      return Response.json({ ok: true });
    }

    if (pathname === '/api/login' && req.method === 'POST') {
      const { password } = await req.json() as { password: string };
      if (password !== PASSWORD) return new Response('Forbidden', { status: 403 });
      const tok = token();
      sessions.add(tok);
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${tok}; Path=/; HttpOnly; SameSite=Strict`
        }
      });
    }

    if (pathname === '/api/logout' && req.method === 'POST') {
      const s = sessionOf(req);
      if (s) sessions.delete(s);
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0'
        }
      });
    }

    if (pathname === '/api/data') {
      const s = sessionOf(req);
      if (!s || !sessions.has(s)) return new Response('Unauthorized', { status: 401 });
      if (!storedData)            return new Response('Not Found',    { status: 404 });
      return Response.json(storedData);
    }

    return new Response(HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
});

console.log('Monitor Diario server running');
