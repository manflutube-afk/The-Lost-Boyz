/**
 * What the visitor numbers look like, for the band.
 *
 *   GET /api/admin/stats          the last 30 days
 *   GET /api/admin/stats?days=90  a longer run
 *
 * Signed in only. None of it identifies anybody -- lib/stats.js explains what
 * is kept and what is deliberately not -- but it is still the band's business
 * and not the public's, so it is behind the same password as the rest.
 *
 * The daily records are read in one go rather than one at a time as the page
 * asks for them. Thirty reads against the store is nothing, and it means the
 * page gets a single answer it can draw in one pass instead of filling in as
 * it goes.
 */
import { isSignedIn } from '../../../lib/admin-auth.js';
import { recentDays, dayKey, ranked } from '../../../lib/stats.js';

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, private' },
  });

/* Roll a set of daily records into one set of totals. */
function combine(days) {
  const all = { visits: 0, pages: {}, countries: {}, from: {}, devices: {} };

  for (const day of days) {
    if (!day || !day.data) { continue; }
    all.visits += day.data.visits || 0;
    for (const group of ['pages', 'countries', 'from', 'devices']) {
      const tally = day.data[group] || {};
      for (const key of Object.keys(tally)) {
        all[group][key] = (all[group][key] || 0) + tally[key];
      }
    }
  }

  return all;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!(await isSignedIn(request, env))) {
    return json({ ok: false, error: 'Sign in first.' }, 401);
  }
  if (!env.VIEWS) {
    return json({ ok: false, error: 'The view store is not set up.' }, 503);
  }

  const asked = parseInt(new URL(request.url).searchParams.get('days'), 10);
  const span = Math.min(Math.max(asked || 30, 1), 90);

  const wanted = recentDays(span);
  const records = await Promise.all(
    wanted.map((date) =>
      env.VIEWS.get(dayKey(date), 'json')
        .then((data) => ({ date, data }))
        .catch(() => ({ date, data: null }))
    )
  );

  const totals = combine(records);

  /*
   * The all-time figure comes from the counter's own key plus the seed, so the
   * badge in the header and this page can never disagree with each other. The
   * daily records only go back as far as they have been kept, and only as far
   * as the day this was built.
   */
  const stored = parseInt(await env.VIEWS.get('total'), 10) || 0;
  const seed = parseInt(env.VIEWS_SEED, 10) || 0;

  return json({
    ok: true,
    allTime: stored + seed,
    days: records.map((r) => ({ date: r.date, visits: (r.data && r.data.visits) || 0 })),
    span,
    visits: totals.visits,
    pages: ranked(totals.pages),
    countries: ranked(totals.countries),
    from: ranked(totals.from),
    devices: ranked(totals.devices, 3),
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') { return onRequestGet(context); }
  return json({ ok: false, error: 'Send this a GET.' }, 405);
}
