/**
 * The queue of things the crowd have sent in, and what the band do with them.
 *
 *   GET    /api/admin/crowd            waiting, and already approved
 *   POST   /api/admin/crowd            { id, decision: 'yes' | 'no',
 *                                        send?, title?, notes? }
 *   DELETE /api/admin/crowd?id=...     take an approved one back off the site
 *
 * Signed in only, checked here rather than trusted from the page that asked.
 *
 * Approving copies the submission into `crowd:live`, which is the one record
 * the public endpoint reads. Until that copy happens there is no route from a
 * stranger's words to the website at all -- not a hidden one, not a slow one.
 * Rejecting deletes the submission and the photograph with it, for good.
 *
 * `send` posts it on to whoever looks after the website, with the photograph
 * attached as a real file and whatever title and notes the band typed. The
 * point of that is the difference between a photograph appearing in the gallery
 * and a photograph being *in the project*: one sits in a store at whatever size
 * a phone sent it, the other goes through source-images, gets built at every
 * size the site uses, and gets proper alt text written for it. Approving puts
 * it up today; sending it on is how it ends up done properly.
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

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/* Base64 for the attachment. Done a chunk at a time because spreading a few
   hundred thousand bytes into String.fromCharCode in one go blows the stack. */
function base64(bytes) {
  const view = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 8192) {
    binary += String.fromCharCode.apply(null, view.subarray(i, i + 8192));
  }
  return btoa(binary);
}

const extensionFor = (type) =>
  type === 'image/png' ? 'png' : (type === 'image/webp' ? 'webp' : 'jpg');

/*
 * Pass a submission on to whoever adds things to the project.
 *
 * The photograph goes as an attachment rather than a link, so it can be dragged
 * straight into source-images without signing in to anything, and it is named
 * after the gig rather than c_1a2b3c4d -- a folder full of those would be
 * useless in a fortnight.
 */
async function sendOn(env, item, title, notes) {
  const apiKey = env.RESEND_API_KEY;
  const to = env.DESIGNER_EMAIL;

  if (!apiKey) { return { sent: false, why: 'Email is not switched on.' }; }
  if (!to) { return { sent: false, why: 'No address to send it to.' }; }

  const rows = [
    ['Title', title],
    ['Notes', notes],
    ['From', [item.name, item.town].filter(Boolean).join(', ')],
    ['Which gig', item.where],
    ['When', item.when],
    ['Their words', item.words],
    ['Clip', item.clip],
  ].filter(([, value]) => value);

  const html =
    '<meta charset="utf-8">'
    + '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;'
    + 'line-height:1.6;color:#222">'
    + '<h1 style="font-size:19px;margin:0 0 14px">'
    + escapeHtml(title || 'For the website')
    + '</h1>'
    + '<table style="border-collapse:collapse">'
    + rows.map(([label, value]) =>
      '<tr><td style="padding:6px 14px 6px 0;color:#6b6478;white-space:nowrap;'
      + 'vertical-align:top">' + escapeHtml(label) + '</td>'
      + '<td style="padding:6px 0;white-space:pre-wrap">' + escapeHtml(value)
      + '</td></tr>').join('')
    + '</table>'
    + (item.photo
      ? '<p style="margin:18px 0 0;color:#6b6478;font-size:13px">The photo is '
        + 'attached. It has already been shrunk to 1600px and had its location '
        + 'data stripped, so it is not the original off their phone.</p>'
      : '')
    + '<p style="margin:18px 0 0;color:#6b6478;font-size:13px">Approved in '
    + 'Backstage, so it is already on the website.</p></div>';

  const text = [
    title || 'For the website',
    '',
    ...rows.map(([label, value]) => label + ': ' + value),
    '',
    item.photo ? 'The photo is attached, shrunk and with its location stripped.' : '',
    'Approved in Backstage, so it is already on the website.',
  ].filter(Boolean).join('\n');

  const payload = {
    from: env.FROM_EMAIL || 'The Lost Boyz <website@thelostboyz.uk>',
    to: [to],
    subject: 'For the site: ' + (title || item.where || item.name),
    html,
    text,
  };

  if (item.photo) {
    const found = await env.DIARY.getWithMetadata(KEYS.pic(item.id), { type: 'arrayBuffer' });
    if (found && found.value) {
      const type = (found.metadata && found.metadata.type) || 'image/jpeg';
      const stem = (item.where || item.name || 'photo')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
      payload.attachments = [{
        filename: (stem || 'photo') + '-' + item.id.slice(2, 8) + '.' + extensionFor(type),
        content: base64(found.value),
      }];
    }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      // named, or an accented name arrives as mojibake
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // the provider's body can echo the request back, so only the status goes on
    return { sent: false, why: 'The mail provider said ' + res.status + '.' };
  }
  return { sent: true, to };
}

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

  /*
   * Posting it on is a separate thing that can fail on its own. It happens
   * after the approval is safely written, and a failure is reported without
   * undoing it -- the submission is on the website either way, and telling the
   * band it did not go up because an email bounced would be untrue.
   */
  let post = null;
  if (body.send) {
    try {
      post = await sendOn(env, item, String(body.title || '').slice(0, 120),
        String(body.notes || '').slice(0, 2000));
    } catch (e) {
      post = { sent: false, why: 'That did not send.' };
    }
  }

  return json({ ok: true, decision: 'yes', item: forPublic(item), post });
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
