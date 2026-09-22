/**
 * The band's diary: every booking they have, public and private.
 *
 * Shared code rather than an endpoint, so it lives outside ./functions where
 * Pages will not turn it into a URL of its own.
 *
 * Where it is kept
 * ----------------
 * One key in KV, holding the whole list as JSON. A band has tens of gigs, not
 * millions, so a key each would mean a listing call and then a read per gig
 * every time anybody opened the diary, for no benefit. One key is one read.
 *
 * The cost of that choice is that two people saving at the same instant can
 * have one of their changes overwritten, because a save is read-modify-write.
 * Every save here changes a single event inside a freshly read list, so the
 * window is the length of one round trip, and there are two people with access.
 * If the band ever grows a manager and a tour agent, this is the thing to
 * revisit.
 *
 * Public and private
 * ------------------
 * Every event carries `onSite`. True means it belongs in Live Dates on the
 * website; false means it is theirs alone -- a wedding, a private party, a
 * birthday do -- and it must never leave this file except to somebody signed
 * in. That is what `forPublic` below is for: it is the only way an event is
 * allowed to reach the public site, and it rebuilds each one field by field
 * rather than deleting the private ones, so a field added here later cannot
 * leak by having been forgotten.
 */

import { stillToCome } from './when.js';

const KEY = 'events';

/* Only these ever reach the public website. Anything not named here -- the fee,
   the contact, what time to load in, the private notes -- stays in the diary. */
const PUBLIC_FIELDS = [
  'date', 'time', 'venue', 'town', 'note',
  'linkLabel', 'ticketUrl', 'infoUrl', 'durationHours',
];

/*
 * `occasion` is deliberately not in that list. A private do is named by what it
 * is -- "Shane's Summer Bash", "Hayley and Tom's wedding" -- and those are real
 * people's names. It is the headline in Backstage and it stays there. A gig
 * that does go on the website says whatever it wants to say in `note`.
 */

const str = (value, limit) =>
  String(value == null ? '' : value).trim().slice(0, limit || 200);

export const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

/** A short, unguessable id. Only ever used to address a row. */
export const newId = () =>
  'e_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((n) => n.toString(16).padStart(2, '0')).join('');

/**
 * Put an event into the shape the diary stores, whatever came in from the
 * form. Every field is named, so nothing unexpected is ever written.
 */
export function tidy(input, existing) {
  const was = existing || {};
  const num = Number(input.durationHours);

  return {
    id: was.id || newId(),
    date: isDate(input.date) ? input.date : was.date || '',
    occasion: str(input.occasion, 160),
    time: str(input.time, 40),
    venue: str(input.venue, 120),
    town: str(input.town, 80),
    note: str(input.note, 300),
    linkLabel: str(input.linkLabel, 40),
    ticketUrl: str(input.ticketUrl, 400),
    infoUrl: str(input.infoUrl, 200),
    durationHours: num > 0 && num <= 24 ? num : '',

    // the switch that decides whether the world sees it
    onSite: input.onSite === true || input.onSite === 'true',

    // theirs alone, whatever the switch says
    arrive: str(input.arrive, 40),
    address: str(input.address, 300),
    contact: str(input.contact, 200),
    fee: str(input.fee, 80),
    privateNote: str(input.privateNote, 2000),

    added: was.added || new Date().toISOString(),
    updated: new Date().toISOString(),
  };
}

/** Soonest first. */
const byDate = (a, b) => String(a.date).localeCompare(String(b.date));

/** Everything in the diary. An empty list and "no diary yet" are different. */
export async function readAll(env) {
  if (!env.DIARY) { return null; }
  const raw = await env.DIARY.get(KEY, 'json');
  if (!Array.isArray(raw)) { return null; }
  return raw.slice().sort(byDate);
}

export async function writeAll(env, list) {
  if (!env.DIARY) { throw new Error('no diary store bound'); }
  await env.DIARY.put(KEY, JSON.stringify(list.slice().sort(byDate)));
}

/**
 * The gigs the website is allowed to show, in the shape gigs.json has always
 * used, so nothing that reads them had to change shape.
 */
export function forPublic(events) {
  return (events || [])
    .filter((e) => e && e.onSite && isDate(e.date))
    .map((e) => {
      const out = {};
      for (const field of PUBLIC_FIELDS) {
        if (e[field] !== '' && e[field] != null) { out[field] = e[field]; }
      }
      return out;
    })
    .sort(byDate);
}

/**
 * The dates that were in public/data/gigs.json before the diary existed.
 *
 * That file is still the site's safety net: if the diary is unreachable, or
 * has never been filled in, the live dates carry on being served from it
 * rather than the section going empty.
 */
export async function readSeedFile(env, origin) {
  const url = new URL('/data/gigs.json', origin);
  const res = env.ASSETS ? await env.ASSETS.fetch(new Request(url)) : await fetch(url);
  if (!res.ok) { throw new Error('gigs.json: ' + res.status); }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.gigs || []);
}

/**
 * Whatever the public site should show right now: the diary if there is one,
 * the old file if there is not.
 *
 * "Right now" is meant literally. A gig that has been played drops out of this
 * four hours after it started, so the website never lists a night that is
 * already over -- and it drops out here, at the source, rather than only in
 * the page that draws the cards. The band keep every one of them in Backstage;
 * it is the public list that is kept to what is still to come.
 */
export async function publicGigs(env, origin) {
  const events = await readAll(env);
  const gigs = events ? forPublic(events) : await readSeedFile(env, origin);
  return stillToCome(gigs);
}

/**
 * First time in, fill the diary from the dates already on the website, so the
 * band open it and find their gigs rather than an empty page. Everything
 * imported is marked as showing on the site, because it already is.
 */
export async function seedFromFile(env, origin) {
  const gigs = await readSeedFile(env, origin);
  // Sorted before it goes back, not only before it is stored. writeAll sorts a
  // copy, so handing back `list` showed the band a jumbled diary on the one
  // load that mattered most -- the first one.
  const list = gigs.map((g) => tidy({ ...g, onSite: true })).sort(byDate);
  await writeAll(env, list);
  return list;
}
