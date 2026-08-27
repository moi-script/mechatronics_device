import type { NextRequest } from 'next/server';

/**
 * Forwards /api/* to the Express service.
 *
 * This is a route handler rather than a next.config rewrite because rewrite
 * destinations are baked into the build, which would pin a deployed image to
 * whatever API URL happened to be set when it was built. Resolving the target
 * per request keeps the same image usable in any environment.
 *
 * It also means the browser only ever talks to this origin, so the API needs no
 * public exposure and the session cookie stays same-site.
 */
const apiUrl = () => process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const HOP_BY_HOP = new Set(['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'set-cookie']);

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const target = new URL(`/api/${path.join('/')}`, apiUrl());
  target.search = req.nextUrl.search;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');
  headers.delete('content-length');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: 'The API is not reachable.' }, { status: 502 });
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.set(key, value);
  });
  // Set-Cookie can repeat, so it has to be copied one at a time.
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;

export const dynamic = 'force-dynamic';
