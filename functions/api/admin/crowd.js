/**
 * The queue of things the crowd have sent in, and what the band do with them.
 *
 *   GET    /api/admin/crowd            waiting, and already approved
 *   POST   /api/admin/crowd            { id, decision: 'yes' | 'no' }
 *   DELETE /api/admin/crowd?id=...     take an approved one back off the site
 *
 * Signed in only, checked here rather than trusted from the page that asked.
 *
 * Approving copies the submission into `crowd:live`, which is the one record
 * the public endpoint reads. Until that copy happens there is no route from a
 * stranger's words to the website at all -- not a hidden one, not a slow one.
 * Rejecting deletes the submission and the photograph with it, for good.
 */
import { isSignedIn, sameOrigin } from '../../../lib/admin-auth.js';
import { KEYS, forPublic, readLive, writeLive } from '../../../lib/crowd.js';

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private' },
  });

async function guard(context, changing) {
  const { request, env } = context;
  if (!(await isSignedIn(request, env))) {
    return json({ ok: false, error: 'Sign in first.' }, 401);
  }
  if (changing && !sameOrigin(request, new URL(request.url))) {
    return json({ ok: false, error: 'Where did that come from?' }, 403);
  }
  if (!env.DIARY) { return json({ ok: false, error: 'No store bound.' }, 503); }
  return null;
}

/* Only ever a key this feature made, so a crafted id cannot reach the diary or
   the enquiries, which live in the same store. */
const ours = (id) => /^c_[0-9a-f]{16}$/.test(String(id || ''));

export async function onRequestGet(context) {
  const stop = await guard(context, false);
  if (stop) { return stop; }

  const { env } = context;

  const listed = await env.DIARY.list({ prefix: KEYS.pending, limit: 1000 });

  /*
   * The listing turns up crowd:live as well, since it shares the prefix. It is
   * the approved record rather than a submission, so it is dropped here.
   */
  const waiting = await Promise.all(
    listed.keys
      .filter((k) => k.name !== KEYS.live && ours(k.name.slice(KEYS.pending.length)))
      .map((k) => env.DIARY.get(k.name, 'json').catch(() => null))
  );

  const live = await readLive(env);
  const approvedIds = new Set(live.map((i) => i.id));

  return json({
    ok: true,
    waiting: waiting
      .filter((item) => item && !approvedIds.has(item.id))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))),
    live: live.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))),
  });
}

export async function onRequestPost(context) {
  const stop = await guard(context, true);
  if (stop) { return stop; }

  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Could not read that.' }, 400);
  }

  const id = String(body.id || '');
  if (!ours(id)) { return json({ ok: false, error: 'No such message.' }, 404); }

  const item = await env.DIARY.get(KEYS.one(id), 'json');
  if (!item) { return json({ ok: false, error: 'No such message.' }, 404); }

  if (body.decision === 'no') {
    /*
     * Gone, both parts. Somebody who has been told no should not have their
     * photograph sitting in a store afterwards, and leaving the record behind
     * would only mean deciding about it again next week.
     */
    await env.DIARY.delete(KEYS.pic(id)).catch(() => {});
    await env.DIARY.delete(KEYS.one(id));
    return json({ ok: true, decision: 'no' });
  }

  if (body.decision !== 'yes') {
    return json({ ok: false, error: 'Say yes or no.' }, 400);
  }

  const live = await readLive(env);
  if (live.some((i) => i.id === id)) {
    return json({ ok: true, decision: 'yes', already: true });
  }

  item.state = 'approved';
  item.approvedAt = new Date().toISOString();

  // Only the public fields are copied across, so the thing the website reads
  // has never held anything the website should not show.
  live.push(forPublic(item));
  await writeLive(env, live);

  // the submission is kept, marked approved, so Backstage can still show it
  await env.DIARY.put(KEYS.one(id), JSON.stringify(item), {
    metadata: { at: item.at, name: item.name, photo: item.photo, state: 'approved' },
  });

  return json({ ok: true, decision: 'yes', item: forPublic(item) });
}

export async function onRequestDelete(context) {
  const stop = await guard(context, true);
  if (stop) { return stop; }

  const { env, request } = context;
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!ours(id)) { return json({ ok: false, error: 'No such message.' }, 404); }

  const live = await readLive(env);
  const left = live.filter((i) => i.id !== id);
  await writeLive(env, left);

  // The submission and its photograph go too. Taking something off the site is
  // the band deciding it should not be there, and leaving the pieces lying
  // around would put it back in the queue to be approved all over again.
  await env.DIARY.delete(KEYS.pic(id)).catch(() => {});
  await env.DIARY.delete(KEYS.one(id)).catch(() => {});

  return json({ ok: true, removed: live.length !== left.length });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET') { return onRequestGet(context); }
  if (method === 'POST') { return onRequestPost(context); }
  if (method === 'DELETE') { return onRequestDelete(context); }
  return json({ ok: false, error: 'Not a thing you can do here.' }, 405);
}
