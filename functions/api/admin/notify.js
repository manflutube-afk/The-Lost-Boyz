/**
 * Send the "check your Backstage" nudge on purpose.
 *
 *   POST /api/admin/notify
 *
 * The nudge normally goes out by itself when something arrives. This is for the
 * times that does not fit: anything that came in before the notifier existed,
 * a message somebody wants to put back in front of the other one, or simply
 * checking the thing works without having to submit something to find out.
 *
 * It ignores the quarter-hour quiet window, because that window is there to
 * stop a flood of automatic emails -- and somebody deliberately pressing a
 * button is not a flood. It is signed in only, so nobody else can use it to
 * send mail from this domain.
 *
 * Like the automatic one, it carries none of what was sent. See lib/notify.js.
 */
import { isSignedIn, sameOrigin } from '../../../lib/admin-auth.js';
import { KEYS } from '../../../lib/crowd.js';
import { tellTheBand } from '../../../lib/notify.js';

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!(await isSignedIn(request, env))) {
    return json({ ok: false, error: 'Sign in first.' }, 401);
  }
  if (!sameOrigin(request, new URL(request.url))) {
    return json({ ok: false, error: 'Where did that come from?' }, 403);
  }
  if (!env.DIARY) { return json({ ok: false, error: 'No store bound.' }, 503); }

  /*
   * Work out what is actually waiting, so the email describes the real queue
   * rather than repeating whatever arrived last. Still only the kinds of thing
   * -- a review, a photo, a video -- never anything anybody typed.
   */
  const listed = await env.DIARY.list({ prefix: KEYS.pending, limit: 1000 });
  const items = await Promise.all(
    listed.keys
      .filter((k) => k.name !== KEYS.live && /^crowd:c_[0-9a-f]{16}$/.test(k.name))
      .map((k) => env.DIARY.get(k.name, 'json').catch(() => null))
  );

  const waiting = items.filter(Boolean);
  if (!waiting.length) {
    return json({ ok: false, error: 'Nothing is waiting, so there is nothing to say.' }, 400);
  }

  const kinds = new Set();
  for (const item of waiting) {
    if (item.words || item.mics) { kinds.add('a review'); }
    if (item.photo) { kinds.add('a photo'); }
    if (item.video) { kinds.add('a video'); }
  }

  const bits = [...kinds];
  const what = bits.length > 1
    ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1]
    : (bits[0] || 'something');

  // `force` skips the quiet window: this was a deliberate press, not a flood.
  const result = await tellTheBand(env, what, { force: true });

  return json({
    ok: !!result.sent,
    ...result,
    waiting: waiting.length,
    described: what,
    error: result.sent ? undefined : ('That did not send: ' + (result.why || 'no reason given')),
  }, result.sent ? 200 : 502);
}

export async function onRequest(context) {
  if (context.request.method === 'POST') { return onRequestPost(context); }
  return json({ ok: false, error: 'Send this a POST.' }, 405);
}
