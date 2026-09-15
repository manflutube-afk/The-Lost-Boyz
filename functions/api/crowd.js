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
 *
 * Why multipart rather than JSON
 * ------------------------------
 * Because of the video. A file sent as JSON has to be base64, which makes it a
 * third bigger again and means holding the whole thing as a string before it
 * can be turned back into bytes. Multipart is what forms have always done with
 * files: the browser builds it, the runtime parses it, and the bytes arrive as
 * bytes. Photographs come the same way now, for consistency.
 */
import {
  LIMITS, KEYS, tidy, forPublic, readLive, imageKind, videoKind,
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

/*
 * Read one uploaded file and be sure it is what it says it is.
 *
 * Size first, because reading the bytes of something enormous only to find out
 * it is too big is the wrong way round. Then the signature, taken from the
 * file's own first bytes rather than the type the browser attached to it --
 * that field is only ever a claim, and a claim from a stranger.
 */
async function fileFrom(form, field, cap, recognise) {
  const file = form.get(field);
  if (!file || typeof file.arrayBuffer !== 'function' || !file.size) { return null; }

  if (file.size > cap) { return { tooBig: true, size: file.size }; }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = recognise(bytes);
  if (!kind) { return { wrongKind: true }; }

  return { bytes, kind };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DIARY) {
    return json({ ok: false, error: 'Not able to take messages just now.' }, 503);
  }

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return json({ ok: false, error: 'Could not read that.' }, 400);
  }

  const field = (name) => String(form.get(name) == null ? '' : form.get(name));

  // A field no person ever sees, and so no person ever fills in. Bots do.
  // Answered cheerfully so whoever sent it learns nothing from failing.
  if (field('website').trim()) { return json({ ok: true }, 200); }

  if (await tooMany(env, request)) {
    return json({
      ok: false,
      error: 'That is a few messages in a short while. Have a breather and try again later.',
    }, 429);
  }

  const item = tidy({
    name: field('name'),
    town: field('town'),
    where: field('where'),
    when: field('when'),
    words: field('words'),
    mics: field('mics'),
  });

  if (!item.name) {
    return json({ ok: false, error: 'Put your name in so the boyz know who to thank.' }, 400);
  }
  if (!item.where) {
    return json({
      ok: false,
      error: 'Which gig was it? A photo with no idea where it was taken is hard to do anything with.',
    }, 400);
  }

  const picture = await fileFrom(form, 'photo', LIMITS.photoBytes, imageKind);
  if (picture && picture.tooBig) {
    return json({ ok: false, error: 'That photo would not go through. Try a smaller one.' }, 400);
  }
  if (picture && picture.wrongKind) {
    return json({ ok: false, error: 'That did not look like a photo.' }, 400);
  }
  if (picture) { item.photo = true; item.photoType = picture.kind; }

  const clip = await fileFrom(form, 'video', LIMITS.videoBytes, videoKind);
  if (clip && clip.tooBig) {
    return json({
      ok: false,
      error: 'That video is too big — ' + Math.round(clip.size / 1e6)
        + 'MB, and the most that will go through is ' + Math.round(LIMITS.videoBytes / 1e6)
        + 'MB. Trim it to ten or fifteen seconds on your phone and send that.',
    }, 413);
  }
  if (clip && clip.wrongKind) {
    return json({ ok: false, error: 'That did not look like a video.' }, 400);
  }
  if (clip) { item.video = true; item.videoType = clip.kind; }

  if (!item.words && !item.mics && !item.photo && !item.video) {
    return json({
      ok: false,
      error: 'Give it a rating, say something, or add a photo or a video.',
    }, 400);
  }

  /*
   * Words without a rating are turned away, on purpose.
   *
   * A wall of reviews with a mic count on some and nothing on others reads as
   * broken, and there is no sensible thing to draw for the missing ones -- five
   * empty mics says one star, and no mics at all leaves a hole. Somebody who
   * has bothered to write a paragraph can pick a number.
   *
   * A photograph or a clip on its own is a different thing entirely and needs
   * neither, which is why this only applies when there are words.
   */
  if (item.words && !item.mics) {
    return json({
      ok: false,
      error: 'How many mics would you give the night? Pick one to go with what you have written.',
    }, 400);
  }

  try {
    if (picture) {
      await env.DIARY.put(KEYS.pic(item.id), picture.bytes, {
        metadata: { type: picture.kind },
      });
    }
    if (clip) {
      await env.DIARY.put(KEYS.vid(item.id), clip.bytes, {
        metadata: { type: clip.kind, size: clip.bytes.length },
      });
    }
    await env.DIARY.put(KEYS.one(item.id), JSON.stringify(item), {
      metadata: {
        at: item.at,
        name: item.name,
        town: item.town,
        photo: item.photo,
        video: item.video,
        mics: item.mics,
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
