/**
 * The live dates the website shows.
 *
 *   GET /api/gigs
 *
 * This is what the home page reads now. It comes from the band's diary, so a
 * date they add on their phone appears here without anybody touching the code,
 * and it carries only the gigs marked as showing on the site -- a private
 * booking cannot reach this endpoint, because forPublic() builds each gig from
 * a named list of fields rather than by removing the private ones.
 *
 * If the diary is unreachable, or has never been filled in, the old
 * public/data/gigs.json is served instead. Live Dates going blank because a
 * store hiccuped would be worse than a list that is a few days out of date,
 * and that file is still a perfectly good list.
 *
 * The answer is cached for a minute. Long enough that a busy evening does not
 * mean a KV read per visitor, short enough that a gig added during a soundcheck
 * is up before the set finishes.
 */
import { publicGigs } from '../../lib/diary.js';

export async function onRequestGet(context) {
  const { env, request } = context;
  const origin = new URL(request.url).origin;

  let gigs;
  try {
    gigs = await publicGigs(env, origin);
  } catch (e) {
    return new Response(JSON.stringify({ gigs: [], error: 'unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  return new Response(JSON.stringify({ gigs }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') { return onRequestGet(context); }
  return new Response('Send this a GET.', { status: 405 });
}
