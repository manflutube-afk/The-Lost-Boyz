/**
 * Signing in and out of the band's diary.
 *
 *   POST /api/admin/login    the password, in exchange for a session cookie
 *   POST /api/admin/logout   throw the cookie away
 *
 * The sign-in page is a plain HTML form with no JavaScript, so this accepts a
 * normal form submission and answers with a redirect. It also accepts JSON, so
 * the diary page itself can offer a sign-in without a full page load. Which one
 * came in is decided by the Content-Type, and the answer matches.
 *
 * Guessing is slowed down deliberately. One shared password is the weak point
 * of this arrangement, and the thing that makes a weak password dangerous is
 * being allowed to try thousands of them, so an address that keeps getting it
 * wrong is turned away for a while. The counter lives in KV; if the store is
 * unreachable the attempt is still allowed through, because locking the band
 * out of their own diary because a database hiccuped would be the worse
 * failure.
 */
import { passwordMatches, makeToken, sessionCookie, clearedCookie, sameOrigin }
  from '../../../lib/admin-auth.js';
import { signInResponse } from '../../../lib/sign-in-page.js';

/* Ten wrong guesses in a quarter of an hour and that address waits. */
const ALLOWED = 10;
const WINDOW_SECONDS = 15 * 60;

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

const wantsJson = (request) =>
  (request.headers.get('content-type') || '').includes('application/json');

const throttleKey = (request) =>
  'throttle:' + (request.headers.get('cf-connecting-ip') || 'unknown');

async function tooManyTries(env, request) {
  if (!env.DIARY) { return false; }
  try {
    const tries = parseInt(await env.DIARY.get(throttleKey(request)), 10) || 0;
    return tries >= ALLOWED;
  } catch (e) {
    return false;
  }
}

async function countWrongTry(env, request) {
  if (!env.DIARY) { return; }
  try {
    const key = throttleKey(request);
    const tries = parseInt(await env.DIARY.get(key), 10) || 0;
    // The expiry is refreshed on every wrong guess, so a steady drip of them
    // never lets the window quietly lapse.
    await env.DIARY.put(key, String(tries + 1), { expirationTtl: WINDOW_SECONDS });
  } catch (e) {
    /* Not worth failing a login over. */
  }
}

async function forgetTries(env, request) {
  if (!env.DIARY) { return; }
  try { await env.DIARY.delete(throttleKey(request)); } catch (e) { /* no matter */ }
}

async function givenPassword(request) {
  try {
    if (wantsJson(request)) {
      const body = await request.json();
      return String(body.password == null ? '' : body.password);
    }
    const form = await request.formData();
    return String(form.get('password') || '');
  } catch (e) {
    return '';
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!sameOrigin(request, url)) {
    return json({ ok: false, error: 'Where did that come from?' }, 403);
  }

  if (!env.ADMIN_PASSWORD) {
    const message = 'No password has been set for the diary yet.';
    return wantsJson(request)
      ? json({ ok: false, reason: 'not-configured', error: message }, 503)
      : signInResponse(message, 503);
  }

  if (await tooManyTries(env, request)) {
    const message = 'Too many tries. Give it a quarter of an hour and have another go.';
    return wantsJson(request)
      ? json({ ok: false, error: message }, 429)
      : signInResponse(message, 429);
  }

  const given = await givenPassword(request);

  if (!(await passwordMatches(given, env.ADMIN_PASSWORD))) {
    await countWrongTry(env, request);
    const message = 'That is not the password.';
    return wantsJson(request)
      ? json({ ok: false, error: message }, 401)
      : signInResponse(message, 401);
  }

  await forgetTries(env, request);
  const cookie = sessionCookie(await makeToken(env.ADMIN_PASSWORD), url);

  if (wantsJson(request)) {
    return json({ ok: true }, 200, { 'Set-Cookie': cookie });
  }

  // 303 so the browser follows it with a GET. A 302 after a POST is allowed to
  // repeat the POST, which would send the password a second time.
  return new Response(null, {
    status: 303,
    headers: { Location: '/admin', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'POST') { return onRequestPost(context); }
  // Somebody has typed the address in. Send them to the door rather than an error.
  return Response.redirect(new URL('/admin', context.request.url).toString(), 303);
}
