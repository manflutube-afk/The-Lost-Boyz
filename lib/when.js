/**
 * When a gig stops being a gig you can go to.
 *
 * Shared code, so it lives outside ./functions where Pages would make it a URL.
 *
 * The rule
 * --------
 * A gig comes off the website four hours after it starts. The 8pm at the
 * Welcome Home on the 19th is gone by midnight, because by then it has been
 * played and it is only taking up room above the ones that have not.
 *
 * Four hours is the floor, not the whole of it. If the band have written a
 * longer set into the diary -- an all-dayer, a festival slot -- the gig stays
 * up for as long as they say it runs. Pulling a listing off the site while
 * they are still on stage would be a worse fault than leaving it an hour too
 * long, so the longer of the two always wins.
 *
 * When the time is not settled
 * ----------------------------
 * A gig marked TBC could be at noon or at ten, so there is no start to count
 * four hours from. It holds its place for the whole of its day and goes at
 * 4am the following morning -- the same grace, measured from the end of the
 * day instead of from a time nobody has given yet.
 *
 * Why the clock work is fiddly
 * ----------------------------
 * The dates are wall-clock Cornwall: "8pm on the 19th" means 8pm as the pub
 * reads it, which is 20:00 UTC in February and 19:00 UTC in June. The server
 * runs in UTC and a visitor's phone runs wherever they are, so neither can
 * simply compare local times -- somebody reading the site from Sydney would
 * otherwise see the list empty out most of a day early. Everything below
 * turns a London wall-clock time into the actual instant it happens, and
 * compares instants.
 */

const TZ = 'Europe/London';

/* The hours after the start that a gig stays up, when nothing longer is set. */
export const GRACE_HOURS = 4;

/*
 * How far Europe/London is from UTC at a given instant -- an hour in summer,
 * nothing in winter. Worked out by asking Intl to format the instant in London
 * and seeing how far the answer has moved, which is the only way to do it that
 * stays right through a clock change.
 */
export function londonOffsetMinutes(atMs) {
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
export function londonToInstant(y, m, d, hh, mm) {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes: the first guess can land the wrong side of a clock change,
  // and re-reading the offset at the corrected instant settles it.
  let ms = naive - londonOffsetMinutes(naive) * 60000;
  ms = naive - londonOffsetMinutes(ms) * 60000;
  return ms;
}

/*
 * The time on a gig is written for people -- "8pm", "7.30pm", "Doors 7pm" --
 * so it is read loosely. If it cannot be understood, null comes back and the
 * caller treats the gig as having no settled time, rather than acting on an
 * hour nobody actually said.
 */
export function readTime(value) {
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

/**
 * The instant a gig should disappear from the website.
 *
 * Returns null for anything without a usable date, which the caller should
 * read as "leave it alone" -- a gig with a broken date is a thing to fix in
 * the diary, not a thing to quietly hide.
 */
export function goesAt(gig) {
  const parts = String((gig && gig.date) || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) { return null; }

  const y = +parts[1];
  const m = +parts[2];
  const d = +parts[3];

  const at = readTime(gig.time);

  if (!at) {
    // No settled start: it keeps the whole day, then the same grace on top.
    return londonToInstant(y, m, d + 1, 0, 0) + GRACE_HOURS * 3600000;
  }

  const hours = Math.max(GRACE_HOURS, Number(gig.durationHours) || 0);
  return londonToInstant(y, m, d, at.hour, at.mins) + hours * 3600000;
}

/** Has this one been and gone? */
export function isOver(gig, nowMs) {
  const ends = goesAt(gig);
  return ends !== null && (nowMs == null ? Date.now() : nowMs) >= ends;
}

/** The gigs still worth listing, soonest first left to the caller. */
export function stillToCome(gigs, nowMs) {
  const now = nowMs == null ? Date.now() : nowMs;
  return (gigs || []).filter((g) => !isOver(g, now));
}
