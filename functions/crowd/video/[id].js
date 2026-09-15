/**
 * A video somebody sent in.
 *
 *   /crowd/video/c_1a2b3c4d
 *
 * Same rule as the photographs: an approved one is public because it is on
 * Reelz, an unapproved one needs the admin cookie, and anything else gets the
 * 404 a made-up id gets -- so the queue cannot be probed by guessing at ids.
 *
 * Why this answers Range requests
 * -------------------------------
 * Because every browser asks with one. A <video> element does not download a
 * file and then play it; it asks for the first slice, then asks for whatever
 * the viewer scrubs to. Handing back the whole thing with a 200 every time
 * technically works -- the browser copes -- but seeking then means fetching
 * twenty megabytes again from the start, and on a phone on pub wifi that is the
 * difference between a clip that plays and one that spins.
 *
 * The store has no notion of ranges, so the value is read whole and the slice
 * is cut here. That is honest about what it costs: the read is the same either
 * way, and what is saved is the sending, which is the expensive half.
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
  const approved = live.some((item) => item.id === id && item.video);

  if (!approved && !(await isSignedIn(request, env))) { return gone(); }

  const found = await env.DIARY.getWithMetadata(KEYS.vid(id), { type: 'arrayBuffer' });
  if (!found || !found.value) { return gone(); }

  const type = (found.metadata && found.metadata.type) || 'video/mp4';
  const whole = found.value;
  const total = whole.byteLength;

  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    // an approved clip never changes; a pending one must leave no copy behind
    'Cache-Control': approved
      ? 'public, max-age=31536000, immutable'
      : 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': 'inline',
  };

  const range = request.headers.get('range');
  const asked = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());

  if (!asked) {
    return new Response(whole, { headers: { ...headers, 'Content-Length': String(total) } });
  }

  let start = asked[1] === '' ? null : parseInt(asked[1], 10);
  let end = asked[2] === '' ? null : parseInt(asked[2], 10);

  // "bytes=-500" means the last 500, not from 0 to 500
  if (start === null) {
    if (end === null || end <= 0) { return gone(); }
    start = Math.max(0, total - end);
    end = total - 1;
  } else if (end === null || end >= total) {
    end = total - 1;
  }

  if (start >= total || start > end) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': 'bytes */' + total },
    });
  }

  return new Response(whole.slice(start, end + 1), {
    status: 206,
    headers: {
      ...headers,
      'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      'Content-Length': String(end - start + 1),
    },
  });
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'GET' || method === 'HEAD') { return onRequestGet(context); }
  return new Response('Send this a GET.', { status: 405 });
}
