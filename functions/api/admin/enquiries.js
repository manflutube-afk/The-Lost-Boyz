/**
 * The enquiries that have come in through the website.
 *
 *   GET    /api/admin/enquiries          the list, newest first
 *   GET    /api/admin/enquiries?id=...   one of them in full
 *   DELETE /api/admin/enquiries?id=...   throw one away, for good
 *
 * These hold what a member of the public typed into a form -- their name, their
 * email address, often a phone number -- so every one of these needs the admin
 * cookie, checked here rather than trusted from the page that asked.
 *
 * The list is built from the keys' metadata, which is one call however many
 * enquiries there are. The message itself is only read when somebody opens it,
 * so browsing the list never pulls anybody's details out of storage.
 *
 * Nothing expires on its own. Somebody who asks to be forgotten is dealt with
 * by the delete button, and that really does remove it -- there is no bin to
 * empty afterwards.
 */
import { isSignedIn, sameOrigin } from '../../../lib/admin-auth.js';

const PREFIX = 'enq:';

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' },
  });

async function guard(context, changing) {
  const { request, env } = context;
  if (!(await isSignedIn(request, env))) {
    return json({ ok: false, error: 'Sign in first.' }, 401);
  }
  if (changing && !sameOrigin(request, new URL(request.url))) {
    return json({ ok: false, error: 'Where did that come from?' }, 403);
  }
  if (!env.DIARY) {
    return json({ ok: false, error: 'The diary store is not set up yet.' }, 503);
  }
  return null;
}

/* Only ever a key this endpoint made. Without this a crafted id could be used
   to read or delete the diary itself, which lives in the same store. */
const ours = (id) => typeof id === 'string' && id.startsWith(PREFIX) && !id.includes('\n');

export async function onRequestGet(context) {
  const stop = await guard(context, false);
  if (stop) { return stop; }

  const { env, request } = context;
  const id = new URL(request.url).searchParams.get('id');

  if (id) {
    if (!ours(id)) { return json({ ok: false, error: 'No such enquiry.' }, 404); }
    const enquiry = await env.DIARY.get(id, 'json');
    if (!enquiry) { return json({ ok: false, error: 'No such enquiry.' }, 404); }
    return json({ ok: true, enquiry });
  }

  const listed = await env.DIARY.list({ prefix: PREFIX, limit: 1000 });

  // The keys carry an ISO timestamp, so sorting the names backwards is
  // newest-first without reading a single value.
  const enquiries = listed.keys
    .map((k) => ({ id: k.name, ...(k.metadata || {}) }))
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));

  return json({ ok: true, enquiries, more: !listed.list_complete });
}

export async function onRequestDelete(context) {
  const stop = await guard(context, true);
  if (stop) { return stop; }

  const { env, request } = context;
  const id = new URL(request.url).searchParams.get('id') || '';

  if (!ours(id)) { return json({ ok: false, error: 'No such enquiry.' }, 404); }

  await env.DIARY.delete(id);
  return json({ ok: true });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET') { return onRequestGet(context); }
  if (method === 'DELETE') { return onRequestDelete(context); }
  return json({ ok: false, error: 'Not a thing you can do here.' }, 405);
}
