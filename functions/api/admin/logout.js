/**
 * Sign out of the band's diary.
 *
 *   POST /api/admin/logout
 *
 * Clearing the cookie is the whole of it. There is nothing kept on the server
 * to tear down, because a session here is only a signed expiry date -- which
 * does mean a copy of the cookie taken off the device beforehand stays good
 * until it lapses. Changing ADMIN_PASSWORD is what revokes everything at once,
 * since the signing key is derived from it.
 */
import { clearedCookie, sameOrigin } from '../../../lib/admin-auth.js';

export async function onRequestPost(context) {
  const { request } = context;
  const url = new URL(request.url);

  if (!sameOrigin(request, url)) {
    return new Response('No.', { status: 403 });
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': clearedCookie(url),
      'Cache-Control': 'no-store',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') { return onRequestPost(context); }
  return new Response('Send this a POST.', { status: 405 });
}
