/**
 * The site's view counter.
 *
 *   GET  /api/views   read the total
 *   POST /api/views   count this visit, then return the new total
 *
 * The number kept in KV is only the count since the counter was built. What
 * gets shown is that plus VIEWS_SEED, so any figure from before -- taken from
 * Cloudflare's analytics, say -- can be folded in without touching the stored
 * count. Changing the seed later just shifts the total; it never loses a view.
 *
 * Two things worth knowing about the storage.
 *
 * KV is eventually consistent and there is no atomic increment, so this reads
 * the number and writes it back. Two visits landing in the same instant can
 * therefore count as one. At this site's traffic that is a rounding error, and
 * the alternative -- a Durable Object -- is a great deal of machinery for a
 * badge in a header.
 *
 * KV also allows a limited number of writes a day on the free plan, which is
 * why a visit is counted once per browser session rather than once per page.
 * Somebody reading four pages is one visit, which is what a counter like this
 * is usually taken to mean anyway, and it keeps the writes an order of
 * magnitude below anything that would run out.
 */

const KEY = 'total';

/*
 * Obvious crawlers are not visitors. This will not catch everything -- nothing
 * does -- but it keeps the number from being mostly robots, and anything that
 * does not run JavaScript never reaches here in the first place.
 */
const BOTS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptime|curl|wget|python-requests|node-fetch/i;

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json',
      // the total changes constantly, so it must never be cached
      'Cache-Control': 'no-store',
    },
  });

async function total(env) {
  const seed = parseInt(env.VIEWS_SEED, 10) || 0;

  if (!env.VIEWS) { return { ok: false, seed, counted: 0 }; }

  const stored = parseInt(await env.VIEWS.get(KEY), 10) || 0;
  return { ok: true, seed, counted: stored };
}

export async function onRequestGet(context) {
  const { seed, counted, ok } = await total(context.env);
  return json({ views: seed + counted, configured: ok });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const agent = request.headers.get('user-agent') || '';
  const { seed, counted, ok } = await total(env);

  // A crawler, or no store bound: hand back the total without adding to it.
  if (!ok || BOTS.test(agent)) {
    return json({ views: seed + counted, counted: false, configured: ok });
  }

  const next = counted + 1;
  try {
    await env.VIEWS.put(KEY, String(next));
  } catch (e) {
    // Out of writes for the day, most likely. The number still reads fine;
    // it simply stops climbing until the allowance resets.
    return json({ views: seed + counted, counted: false, configured: true });
  }

  return json({ views: seed + next, counted: true, configured: true });
}
