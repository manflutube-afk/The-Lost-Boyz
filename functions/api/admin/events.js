/**
 * The band's diary, read and written.
 *
 *   GET    /api/admin/events        every booking they have
 *   POST   /api/admin/events        add one
 *   PUT    /api/admin/events        change one   (the id is in the body)
 *   DELETE /api/admin/events?id=... remove one
 *
 * Everything here is behind the same password as /admin, checked on each
 * request rather than trusted from the page that called it -- a Function is
 * reachable directly, so the gate in the middleware protects the page and this
 * protects the data.
 *
 * On the very first GET, if there is no diary yet, the dates already published
 * on the website are imported so the band open it and find their gigs rather
 * than an empty page. It happens once and only from a signed-in request.
 */
import { isSignedIn, sameOrigin } from '../../../lib/admin-auth.js';
import { readAll, writeAll, seedFromFile, tidy, isDate } from '../../../lib/diary.js';
import { isOver } from '../../../lib/when.js';

/*
 * Every booking goes out carrying whether it has been and gone, worked out
 * with the very rule the website uses to decide what to list -- four hours
 * after the start, or 4am for one whose time is still TBC.
 *
 * It is done here rather than in the page because the page comparing dates on
 * its own would drift: a Sunday afternoon gig is off the website by six and
 * Backstage would still have said "on the website" until midnight, which is
 * precisely the sort of thing that has to be true if the band are to trust it.
 * It is added on the way out only -- tidy() names every field it stores, so
 * this never finds its way back into the diary.
 */
const mark = (event) => ({ ...event, gone: isOver(event) });

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private' },
  });

const notYou = () => json({ ok: false, error: 'Sign in first.' }, 401);

/*
 * A booking has to be recognisable, but not necessarily by its venue. A private
 * function often gets into the diary as "Shane's Summer Bash, 10 July" months
 * before anybody knows which hall it is in, and refusing that would push the
 * band back to writing it on the back of an envelope.
 */
const named = (body) =>
  !!(String(body.venue || '').trim() || String(body.occasion || '').trim());
const noStore = () =>
  json({ ok: false, error: 'The diary store is not set up yet. See the README.' }, 503);

/* Everything past this point needs a valid cookie; the mutations need the
   request to have come from this site as well. */
async function guard(context, changing) {
  const { request, env } = context;
  if (!(await isSignedIn(request, env))) { return notYou(); }
  if (changing && !sameOrigin(request, new URL(request.url))) {
    return json({ ok: false, error: 'Where did that come from?' }, 403);
  }
  if (!env.DIARY) { return noStore(); }
  return null;
}

export async function onRequestGet(context) {
  const stop = await guard(context, false);
  if (stop) { return stop; }

  const { env, request } = context;
  const origin = new URL(request.url).origin;

  let events = await readAll(env);
  let imported = 0;

  if (!events) {
    try {
      events = await seedFromFile(env, origin);
      imported = events.length;
    } catch (e) {
      // No diary and no file to build one from: an empty diary is still a
      // working diary, so say so rather than showing an error page.
      events = [];
    }
  }

  return json({ ok: true, events: events.map(mark), imported });
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

  if (!isDate(body.date)) {
    return json({ ok: false, error: 'That needs a date, as YYYY-MM-DD.' }, 400);
  }
  if (!named(body)) {
    return json({ ok: false, error: 'That needs a venue, or something to call it.' }, 400);
  }

  const events = (await readAll(env)) || [];
  const event = tidy(body);
  events.push(event);
  await writeAll(env, events);

  return json({ ok: true, event: mark(event) });
}

export async function onRequestPut(context) {
  const stop = await guard(context, true);
  if (stop) { return stop; }

  const { env, request } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Could not read that.' }, 400);
  }

  if (!isDate(body.date)) {
    return json({ ok: false, error: 'That needs a date, as YYYY-MM-DD.' }, 400);
  }
  if (!named(body)) {
    return json({ ok: false, error: 'That needs a venue, or something to call it.' }, 400);
  }

  const events = (await readAll(env)) || [];
  const at = events.findIndex((e) => e.id === body.id);
  if (at < 0) {
    return json({ ok: false, error: 'That one is not in the diary any more.' }, 404);
  }

  // Read, change the one row, write the lot back. The list is read again here
  // rather than trusting whatever the page was holding, so a change made on a
  // phone while this tab sat open is not quietly undone.
  const event = tidy(body, events[at]);
  events[at] = event;
  await writeAll(env, events);

  return json({ ok: true, event: mark(event) });
}

export async function onRequestDelete(context) {
  const stop = await guard(context, true);
  if (stop) { return stop; }

  const { env, request } = context;
  const id = new URL(request.url).searchParams.get('id') || '';

  const events = (await readAll(env)) || [];
  const left = events.filter((e) => e.id !== id);

  if (left.length === events.length) {
    return json({ ok: false, error: 'That one is not in the diary any more.' }, 404);
  }

  await writeAll(env, left);
  return json({ ok: true });
}

/* Anything else gets a plain answer rather than falling through to the site. */
export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET') { return onRequestGet(context); }
  if (method === 'POST') { return onRequestPost(context); }
  if (method === 'PUT') { return onRequestPut(context); }
  if (method === 'DELETE') { return onRequestDelete(context); }
  return json({ ok: false, error: 'Not a thing you can do here.' }, 405);
}
