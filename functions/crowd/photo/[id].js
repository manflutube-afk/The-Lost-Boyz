/**
 * A photograph somebody sent in.
 *
 *   /crowd/photo/c_1a2b3c4d
 *
 * An approved one is public, because it is on the gallery. An unapproved one is
 * not, and that is checked here rather than assumed from the fact that nothing
 * links to it -- an id in an address bar is not a secret, and "nobody will
 * guess it" is not a way to keep a stranger's photograph off the internet.
 *
 * So: approved, or signed in. Anything else gets the same 404 a made-up id
 * gets, which means the queue cannot be probed for what is in it either.
 */
import { KEYS, readLive } from '../../../lib/crowd.js';
import { isSignedIn } from '../../../lib/admin-auth.js';

const gone = () => new Response('Not found.', {
  status: 404,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const id = String(params.id || '');

  if (!/^c_[0-9a-f]{16}$/.test(id) || !env.DIARY) { return gone(); }

  const live = await readLive(env);
  const approved = live.some((item) => item.id === id && item.photo);

  if (!approved && !(await isSignedIn(request, env))) { return gone(); }

  const found = await env.DIARY.getWithMetadata(KEYS.pic(id), { type: 'arrayBuffer' });
  if (!found || !found.value) { return gone(); }

  const type = (found.metadata && found.metadata.type) || 'image/jpeg';

  return new Response(found.value, {
    headers: {
      'Content-Type': type,
      /*
       * An approved photograph never changes -- the id belongs to that one
       * submission -- so it can be held for a year. A pending one must not be
       * cached anywhere at all, or a copy could outlive a rejection.
       */
      'Cache-Control': approved
        ? 'public, max-age=31536000, immutable'
        : 'no-store, private',
      // it is a photograph, and nothing else, whatever anybody renames it to
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'inline',
    },
  });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET' || method === 'HEAD') { return onRequestGet(context); }
  return new Response('Send this a GET.', { status: 405 });
}
