/**
 * Hands back a calendar file for one gig.
 *
 *   /calendar?date=2027-01-16&venue=The%20Ship%20Inn   a gig from the website
 *   /calendar?id=e_1a2b3c4d                            one row of the diary
 *
 * The first form is the button on the live dates: it looks the gig up by date
 * among the ones the site shows, so nothing here needs editing when the diary
 * changes.
 *
 * The second is the button inside the band's own diary, and it is the only way
 * a private booking is ever written into a calendar file. It needs the admin
 * cookie, checked here and not merely assumed from the page that called it --
 * without it a private event is answered exactly as a made-up id would be, so
 * guessing at ids tells you nothing about which ones exist.
 *
 * A private event also gets the things the band actually need on the night:
 * the full address, what time to be there, who to ask for and what the fee is.
 * None of that is on a public gig's entry, because none of it is public.
 *
 * Why a server file rather than building it in the browser: served with a
 * Content-Type of text/calendar, every phone and desktop knows what it is and
 * offers to add it. Generated in the page instead it would be a blob URL, and
 * those are handled inconsistently -- iOS in particular is happier being given
 * a real file. It also means the button is an ordinary link that works whether
 * or not the page's JavaScript has run.
 */
import { publicGigs, readAll } from '../lib/diary.js';
import { isSignedIn } from '../lib/admin-auth.js';
/* The same clock work that decides when a gig comes off the website, so the
   two can never disagree about what "8pm on the 19th" means. */
import { readTime, londonToInstant } from '../lib/when.js';

/* How long to put in the calendar when the gig does not say. */
const DEFAULT_HOURS = 3;

const text = (body, status, headers) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } });

const two = (n) => String(n).padStart(2, '0');

const stampUtc = (ms) => {
  const d = new Date(ms);
  return d.getUTCFullYear() + two(d.getUTCMonth() + 1) + two(d.getUTCDate())
    + 'T' + two(d.getUTCHours()) + two(d.getUTCMinutes()) + two(d.getUTCSeconds()) + 'Z';
};

const stampDate = (y, m, d) => `${y}${two(m)}${two(d)}`;

/* Commas, semicolons, backslashes and newlines all mean something in a
   calendar file, so they are escaped rather than passed through. */
const esc = (s) => String(s)
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/* Lines are limited to 75 octets, continued with a leading space. */
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) { return line; }

  const out = [];
  let current = '';
  let used = 0;

  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length;
    // 74 leaves room for the space that starts a continued line
    if (used + size > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      used = 0;
    }
    current += ch;
    used += size;
  }
  out.push(current);

  return out.join('\r\n ');
}

/*
 * HEAD is answered by the same handler. Without this, only GET is claimed and
 * a HEAD falls past the Function to the static router, which has no file at
 * this address and returns 404 -- so anything that checks a link before
 * following it, and some download managers, would decide it was broken. The
 * runtime drops the body for a HEAD by itself; the headers are what matter.
 */
export async function onRequestHead(context) {
  return onRequestGet(context);
}

/* Pick out one gig, either by its diary id or by the date on the website. */
async function findGig(request, env, url) {
  const wantId = (url.searchParams.get('id') || '').trim();

  if (wantId) {
    // The diary. Signed in or nothing -- and "nothing" is the same answer a
    // wrong id gets, so this cannot be used to find out what is in there.
    if (!(await isSignedIn(request, env))) { return { error: 'notFound' }; }

    const events = await readAll(env);
    const event = (events || []).find((e) => e.id === wantId);
    if (!event) { return { error: 'notFound' }; }
    return { gig: event, private: !event.onSite };
  }

  const wantDate = (url.searchParams.get('date') || '').trim();
  const wantVenue = (url.searchParams.get('venue') || '').trim().toLowerCase();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(wantDate)) { return { error: 'noDate' }; }

  let gigs;
  try {
    gigs = await publicGigs(env, url.origin);
  } catch (e) {
    return { error: 'unavailable' };
  }

  const matches = gigs.filter((g) => g.date === wantDate);
  const gig = (wantVenue && matches.find((g) => String(g.venue || '').toLowerCase() === wantVenue))
    || matches[0];

  return gig ? { gig, private: false } : { error: 'notFound' };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const found = await findGig(request, env, url);

  if (found.error === 'noDate') {
    return text('Give this a date, as ?date=YYYY-MM-DD', 400);
  }
  if (found.error === 'unavailable') {
    return text('Could not read the gig list just now.', 502);
  }
  if (found.error) {
    return text('No gig in the diary on that date.', 404);
  }

  const gig = found.gig;
  const [y, m, d] = String(gig.date).split('-').map(Number);
  const at = readTime(gig.time);

  /*
   * The band's own copy of a private booking carries the address they are
   * driving to. A public gig carries the venue and the town, which is what the
   * website says and all a visitor needs.
   */
  const where = found.private && gig.address
    ? gig.address
    : [gig.venue, gig.town].filter(Boolean).join(', ');

  /*
   * What this says in somebody's calendar. A private do is known by what it is,
   * so "Shane's Summer Bash" leads and the band's name follows; a public gig is
   * the other way round, because that is how it reads on the website.
   */
  const summary = found.private && gig.occasion
    ? gig.occasion + ' — The Lost Boyz'
    : (found.private ? 'The Lost Boyz (private)' : 'The Lost Boyz')
      + (gig.venue ? ' at ' + gig.venue : '');

  /*
   * A gig whose time is not settled yet says so in full. Writing "Starts TBC"
   * into somebody's calendar reads like a typo; "Start time to be confirmed"
   * does not. That covers a time left empty and a time written as TBC and
   * anything else readTime could not make sense of -- all three are the same
   * situation, and in all three no hour is going into the entry either.
   */
  const lines0 = [
    gig.note || '',
    at ? 'Starts ' + gig.time : 'Start time to be confirmed',
  ];

  // Everything below this point is for the band alone and is only reached by a
  // signed-in request for a private booking.
  if (found.private) {
    lines0.push(
      gig.arrive ? 'Be there by ' + gig.arrive : '',
      gig.contact ? 'Contact: ' + gig.contact : '',
      gig.fee ? 'Fee: ' + gig.fee : '',
      gig.privateNote || ''
    );
  }

  lines0.push(gig.infoUrl ? 'https://thelostboyz.uk' + gig.infoUrl : (gig.ticketUrl || ''));

  const details = lines0.filter(Boolean).join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Lost Boyz//thelostboyz.uk//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable, so adding the same gig twice updates it rather than duplicating
    `UID:${gig.id || (gig.date + '-' + (gig.venue || 'gig').toLowerCase().replace(/[^a-z0-9]+/g, '-'))}@thelostboyz.uk`,
    `DTSTAMP:${stampUtc(Date.now())}`,
  ];

  if (at) {
    const startMs = londonToInstant(y, m, d, at.hour, at.mins);
    const hours = Number(gig.durationHours) > 0 ? Number(gig.durationHours) : DEFAULT_HOURS;
    lines.push(`DTSTART:${stampUtc(startMs)}`);
    lines.push(`DTEND:${stampUtc(startMs + hours * 3600000)}`);
  } else {
    // No time given, so none is invented: it goes in as an all-day entry.
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    lines.push(`DTSTART;VALUE=DATE:${stampDate(y, m, d)}`);
    lines.push(`DTEND;VALUE=DATE:${stampDate(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate())}`);
  }

  lines.push(`SUMMARY:${esc(summary)}`);
  if (where) { lines.push(`LOCATION:${esc(where)}`); }
  if (details) { lines.push(`DESCRIPTION:${esc(details)}`); }
  // A private booking has no page on the website to point at.
  if (!found.private) { lines.push(`URL:https://thelostboyz.uk${gig.infoUrl || '/#live'}`); }
  else if (gig.infoUrl) { lines.push(`URL:https://thelostboyz.uk${gig.infoUrl}`); }
  lines.push('END:VEVENT', 'END:VCALENDAR');

  const body = lines.map(fold).join('\r\n') + '\r\n';

  const slug = [gig.venue || gig.occasion, gig.town].filter(Boolean).join('-')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'gig';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="the-lost-boyz-${slug}-${gig.date}.ics"`,
      // A private booking must not be held in any cache but the band's own.
      'Cache-Control': found.private ? 'no-store, private' : 'public, max-age=300',
    },
  });
}
