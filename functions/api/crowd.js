/**
 * What the crowd think -- the public end of it.
 *
 *   GET  /api/crowd   what the band have approved
 *   POST /api/crowd   somebody sending something in
 *
 * The GET reads one record, `crowd:live`, which nothing but an approval in
 * Backstage ever writes to. It cannot reach the pending queue, because it never
 * looks there. That is the whole safety of this: not a flag that has to be
 * checked correctly every time, but a public endpoint that has no way of
 * getting at unapproved words even if somebody later gets the flag wrong.
 *
 * The POST writes to the queue and nowhere else. Sending something in has no
 * effect a visitor can see beyond a thank you, which is the honest answer --
 * it has been sent, and one of the band will look at it.
 */
import {
  LIMITS, KEYS, tidy, forPublic, readLive,
  bytesFromDataUrl, imageKind,
} from '../../lib/crowd.js';

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

/* Six in an hour from one address. Generous for a pub full of people on the
   same wifi after a gig, mean enough to be no use to anybody scripting it. */
const PER_HOUR = 6;

async function tooMany(env, request) {
  if (!env.DIARY) { return false; }
  const key = 'crowdrate:' + (request.headers.get('cf-connecting-ip') || 'unknown');
  try {
    const sent = parseInt(await env.DIARY.get(key), 10) || 0;
    if (sent >= PER_HOUR) { return true; }
    await env.DIARY.put(key, String(sent + 1), { expirationTtl: 3600 });
    return false;
  } catch (e) {
    // The store having a moment must not stop somebody's message.
    return false;
  }
}

export async function onRequestGet(context) {
  const { env } = context;

  let live = [];
  try {
    live = await readLive(env);
  } catch (e) {
    return json({ crowd: [] }, 200, { 'Cache-Control': 'no-store' });
  }

  // newest first, and only ever the approved fields
  const crowd = live
    .slice()
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))
    .map(forPublic);

  return json({ crowd }, 200, { 'Cache-Control': 'public, max-age=60' });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DIARY) {
    return json({ ok: false, error: 'Not able to take messages just now.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Could not read that.' }, 400);
  }

  // A field no person ever sees, and so no person ever fills in. Bots do.
  // Answered cheerfully so whoever sent it learns nothing from failing.
  if (String(body.website || '').trim()) { return json({ ok: true }, 200); }

  if (await tooMany(env, request)) {
    return json({
      ok: false,
      error: 'That is a few messages in a short while. Have a breather and try again later.',
    }, 429);
  }

  const item = tidy(body);

  if (!item.name) {
    return json({ ok: false, error: 'Put your name in so the boyz know who to thank.' }, 400);
  }
  if (!item.where) {
    return json({
      ok: false,
      error: 'Which gig was it? A photo with no idea where it was taken is hard to do anything with.',
    }, 400);
  }

  /* A photograph, if one came. Checked by its actual bytes rather than by what
     the sender said it was, and stored under its own key so the submission
     record stays small and cheap to list. */
  let picture = null;
  if (body.photo) {
    const bytes = bytesFromDataUrl(body.photo);
    if (!bytes) {
      return json({
        ok: false,
        error: 'That photo would not go through. Try a smaller one.',
      }, 400);
    }
    const kind = imageKind(bytes);
    if (!kind) {
      return json({ ok: false, error: 'That did not look like a photo.' }, 400);
    }
    picture = { bytes, kind };
    item.photo = true;
    item.photoType = kind;
  }

  if (!item.words && !item.clip && !item.photo) {
    return json({
      ok: false,
      error: 'Say something, add a photo, or paste a link to a clip.',
    }, 400);
  }

  try {
    if (picture) {
      await env.DIARY.put(KEYS.pic(item.id), picture.bytes, {
        metadata: { type: picture.kind },
      });
    }
    await env.DIARY.put(KEYS.one(item.id), JSON.stringify(item), {
      metadata: {
        at: item.at,
        name: item.name,
        town: item.town,
        photo: item.photo,
        clip: !!item.clip,
        state: 'pending',
      },
    });
  } catch (e) {
    return json({
      ok: false,
      error: 'That did not send. Please try again in a moment.',
    }, 502);
  }

  /*
   * Said plainly. "Thanks, it is live" would be a lie, and "awaiting
   * moderation" is language nobody in a pub uses -- the band will read it, and
   * that is what is happening.
   */
  return json({ ok: true, message: 'Thank you. One of the boyz will have a read.' });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET' || method === 'HEAD') { return onRequestGet(context); }
  if (method === 'POST') { return onRequestPost(context); }
  return json({ ok: false, error: 'Not a thing you can do here.' }, 405);
}
