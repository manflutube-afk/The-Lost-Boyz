/**
 * Hands back a calendar file for one gig.
 *
 *   /calendar?date=2027-01-16&venue=The%20Ship%20Inn
 *
 * The gigs live in one place -- public/data/gigs.json -- and this reads that
 * same file, so adding a date to the JSON is still the only thing anybody has
 * to do. Nothing here needs editing when the diary changes.
 *
 * Why a server file rather than building it in the browser: served with a
 * Content-Type of text/calendar, every phone and desktop knows what it is and
 * offers to add it. Generated in the page instead it would be a blob URL, and
 * those are handled inconsistently -- iOS in particular is happier being given
 * a real file. It also means the button is an ordinary link that works whether
 * or not the page's JavaScript has run.
 */

/* How long to put in the calendar when the gig does not say. */
const DEFAULT_HOURS = 3;

const TZ = 'Europe/London';

const text = (body, status, headers) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers } });

/*
 * How far Europe/London is from UTC at a given instant -- an hour in summer,
 * nothing in winter. Worked out by asking Intl to format the instant in London
 * and seeing how far the answer has moved, which is the only way to do it that
 * stays right through a clock change.
 */
function londonOffsetMinutes(atMs) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(atMs)).reduce((all, p) => {
    all[p.type] = p.value;
    return all;
  }, {});

  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day,
    +parts.hour % 24, +parts.minute, +parts.second);

  return (asIfUtc - atMs) / 60000;
}

/* A wall-clock time in London, turned into the instant it actually happens. */
function londonToInstant(y, m, d, hh, mm) {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes: the first guess can land the wrong side of a clock change,
  // and re-reading the offset at the corrected instant settles it.
  let ms = naive - londonOffsetMinutes(naive) * 60000;
  ms = naive - londonOffsetMinutes(ms) * 60000;
  return ms;
}

/*
 * The time in gigs.json is written for people -- "8pm", "7.30pm", "Doors 7pm"
 * -- so it is read loosely. If it cannot be understood, null comes back and
 * the event is written as an all-day one rather than being given a start time
 * nobody actually said.
 */
function readTime(value) {
  if (!value) { return null; }

  const m = String(value).toLowerCase()
    .match(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
  if (!m) { return null; }

  let hour = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const half = m[3];

  if (half === 'pm' && hour < 12) { hour += 12; }
  if (half === 'am' && hour === 12) { hour = 0; }
  // no am/pm and a small number: an evening gig, not breakfast
  if (!half && hour <= 11) { hour += 12; }

  if (hour > 23 || mins > 59) { return null; }
  return { hour, mins };
}

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

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const wantDate = (url.searchParams.get('date') || '').trim();
  const wantVenue = (url.searchParams.get('venue') || '').trim().toLowerCase();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(wantDate)) {
    return text('Give this a date, as ?date=YYYY-MM-DD', 400);
  }

  // Read the same file the page reads. env.ASSETS serves it straight from the
  // deployment without another trip out to the edge and back.
  let gigs;
  try {
    const assetUrl = new URL('/data/gigs.json', url.origin);
    const res = env.ASSETS
      ? await env.ASSETS.fetch(new Request(assetUrl))
      : await fetch(assetUrl);
    if (!res.ok) { throw new Error('gigs.json: ' + res.status); }
    gigs = (await res.json()).gigs || [];
  } catch (e) {
    return text('Could not read the gig list just now.', 502);
  }

  const matches = gigs.filter((g) => g.date === wantDate);
  const gig = (wantVenue && matches.find((g) => String(g.venue || '').toLowerCase() === wantVenue))
    || matches[0];

  if (!gig) { return text('No gig in the diary on that date.', 404); }

  const [y, m, d] = wantDate.split('-').map(Number);
  const at = readTime(gig.time);

  const where = [gig.venue, gig.town].filter(Boolean).join(', ');
  const summary = 'The Lost Boyz' + (gig.venue ? ' at ' + gig.venue : '');

  const details = [
    gig.note || '',
    gig.time ? 'Starts ' + gig.time : '',
    gig.infoUrl ? 'https://thelostboyz.uk' + gig.infoUrl : (gig.ticketUrl || ''),
  ].filter(Boolean).join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Lost Boyz//thelostboyz.uk//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // Stable, so adding the same gig twice updates it rather than duplicating
    `UID:${wantDate}-${(gig.venue || 'gig').toLowerCase().replace(/[^a-z0-9]+/g, '-')}@thelostboyz.uk`,
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
  lines.push(`URL:https://thelostboyz.uk${gig.infoUrl || '/#live'}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  const body = lines.map(fold).join('\r\n') + '\r\n';

  const slug = [gig.venue, gig.town].filter(Boolean).join('-')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'gig';

  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="the-lost-boyz-${slug}-${wantDate}.ics"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}
