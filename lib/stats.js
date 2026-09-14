/**
 * What the band can know about their visitors, and what they deliberately cannot.
 *
 * Shared code, so it lives outside ./functions where Pages would make it a URL.
 *
 * What is kept
 * ------------
 * One record per day, holding nothing but counts:
 *
 *   stats:2026-09-15  { visits, pages:{}, countries:{}, from:{}, devices:{} }
 *
 * That is the whole design, and the shape is the privacy policy. There is no
 * row per person to join up, because there are no rows per person -- a visit
 * adds one to four tallies and is then indistinguishable from every other visit
 * that day. No IP addresses, no identifiers, no cookies beyond the one flag in
 * the visitor's own browser that stops them being counted twice, and no full
 * URLs of the pages they came from. The country comes from Cloudflare, which
 * knows it anyway from routing the request, and is recorded as a two-letter
 * code and nothing finer.
 *
 * The band get to know that eleven people came from Facebook on Saturday and
 * nine of them were on phones. They do not get to know who, and neither does
 * anybody who ever gets hold of this store.
 *
 * Why one record a day
 * --------------------
 * KV allows a limited number of writes a day on the free plan, and a visit
 * already spends one on the running total. Rolling the day up into a single
 * record costs one more, so the ceiling is around 500 visits a day rather than
 * a hundred. If this site ever outgrows that, the answer is Cloudflare Web
 * Analytics rather than a cleverer version of this.
 *
 * The cost of one shared record is that two visits landing in the same instant
 * can count as one, because the write is read-modify-write. At this site's
 * traffic that is a rounding error, and it is the same trade the view counter
 * already makes.
 *
 * Old days expire on their own after a bit over a year, so nothing accumulates
 * for ever and nobody has to remember to clear it out.
 */

const KEEP_DAYS = 400;

/* Today in London, which is the day the band would say it was. Everything is
   read back in the same terms, so the numbers line up with their week. */
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export const dayKey = (date) => 'stats:' + date;

/* The last n days, newest last, whether or not anything happened on them. */
export function recentDays(n) {
  const out = [];
  const now = new Date(today() + 'T12:00:00Z');
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/*
 * Phone, tablet or desktop, worked out roughly and on purpose. A precise
 * answer would mean keeping the user agent string, which is the most
 * identifying thing a browser hands over without being asked.
 */
export function deviceFrom(agent) {
  const ua = String(agent || '').toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) { return 'tablet'; }
  if (/mobile|iphone|ipod|android|blackberry|windows phone/.test(ua)) { return 'phone'; }
  return 'desktop';
}

/*
 * Where they came from, as a bare host and nothing more.
 *
 * The full referring URL can carry a search somebody typed, or the name of a
 * private group they followed a link from, so only the host is kept. Anything
 * from this site is not a source at all -- it is the visitor moving around --
 * and no referrer at all means they typed it, used a bookmark, or came from an
 * app that strips it.
 */
export function sourceFrom(referrer, ownHost) {
  if (!referrer) { return 'direct'; }
  let host;
  try {
    host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, '');
  } catch (e) {
    return 'direct';
  }
  /*
   * The site's own addresses are not a source -- that is the visitor moving
   * from one page to another. The host the request arrived on is not enough on
   * its own: a preview deployment, a pages.dev address or a local build all
   * serve the same site under a different name, and a link followed across
   * them would otherwise show up in the band's figures as somebody referring
   * them to themselves.
   */
  const ours = String(ownHost || '').toLowerCase().replace(/^www\./, '');
  const internal = host === ours
    || host === 'thelostboyz.uk'
    || host.endsWith('.thelostboyz.uk')
    || host.endsWith('.pages.dev')
    || host === 'localhost'
    || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);

  if (!host || internal) { return 'direct'; }
  // the ones worth naming plainly rather than by whichever domain they used
  if (/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$/.test(host)) { return 'Facebook'; }
  if (/(^|\.)instagram\.com$/.test(host)) { return 'Instagram'; }
  if (/(^|\.)google\./.test(host)) { return 'Google'; }
  if (/(^|\.)bing\.com$/.test(host)) { return 'Bing'; }
  if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(host)) { return 'YouTube'; }
  if (/(^|\.)x\.com$|(^|\.)twitter\.com$|(^|\.)t\.co$/.test(host)) { return 'X'; }
  if (/(^|\.)whatsapp\.com$/.test(host)) { return 'WhatsApp'; }
  return host;
}

/* A page path, tidied and kept short. Query strings are dropped -- they are
   where tracking parameters and typed searches live. */
export function pageFrom(path) {
  let clean = String(path || '/').split('?')[0].split('#')[0].trim();
  if (!clean.startsWith('/')) { clean = '/' + clean; }
  if (clean.length > 1) { clean = clean.replace(/\/+$/, ''); }
  return clean.slice(0, 80) || '/';
}

const bump = (tally, key) => {
  if (!key) { return; }
  tally[key] = (tally[key] || 0) + 1;
};

/** Add one visit to today's record. */
export async function record(env, { page, source, country, device }) {
  if (!env.VIEWS) { return; }

  const key = dayKey(today());
  const day = (await env.VIEWS.get(key, 'json')) || {
    visits: 0, pages: {}, countries: {}, from: {}, devices: {},
  };

  day.visits = (day.visits || 0) + 1;
  bump(day.pages, page);
  bump(day.countries, country);
  bump(day.from, source);
  bump(day.devices, device);

  await env.VIEWS.put(key, JSON.stringify(day), {
    expirationTtl: KEEP_DAYS * 86400,
  });
}

/** Turn a tally into a sorted list, biggest first. */
export const ranked = (tally, limit) =>
  Object.keys(tally || {})
    .map((name) => ({ name, count: tally[name] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit || 12);
