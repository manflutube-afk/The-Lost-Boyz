/**
 * What the crowd think -- the words and photographs people send in.
 *
 * Shared code, so it lives outside ./functions where Pages would make it a URL.
 *
 * The rule the whole thing is built around
 * ----------------------------------------
 * Nothing a stranger sends appears on the website until one of the band has
 * looked at it and said yes. Not for a minute, not "pending moderation" in
 * small grey type at the bottom -- not at all. A submission goes into a queue
 * only Backstage can read, and the public endpoint serves a separate record
 * that only an approval writes to. There is no code path from the form to the
 * page, which is a stronger guarantee than a flag everyone remembers to check.
 *
 * That matters more than usual here. This is a memorial site for a lad who
 * died, built for a band who are not technical, and the cost of somebody
 * posting something vile and it being visible for even an hour is not a bug
 * report -- it is a phone call the band should never have to take.
 *
 * Where things are kept
 * ---------------------
 *   crowd:<id>      the submission, as JSON
 *   crowdpic:<id>   the photograph, as bytes
 *   crowd:live      everything approved, as one record the public endpoint reads
 *
 * One key for the approved lot means the public section is a single read
 * however many there are, and -- more to the point -- means the endpoint that
 * faces the world never goes anywhere near the pending queue.
 *
 * About the photographs
 * ---------------------
 * They are shrunk in the sender's own browser before they are ever uploaded.
 * That is not only to keep them small: redrawing an image through a canvas
 * throws away its EXIF, and EXIF on a phone photo routinely carries the exact
 * spot it was taken. Somebody sending a snap from a pub should not be handing
 * over their location, and the band should not be storing it.
 *
 * The bytes are still checked here rather than trusted, because anything the
 * browser does can be skipped by whoever is not using a browser.
 */

export const LIMITS = {
  name: 60,
  town: 60,
  where: 120,
  when: 40,
  words: 1200,

  /* A photo resized to 1600px lands nearer 300KB, so this is loose enough for
     an odd one and tight enough that nobody fills the store in one request. */
  photoBytes: 1_100_000,

  /*
   * Twenty megabytes of video, and that is a hard ceiling rather than a choice:
   * a KV value cannot exceed twenty-five, and video is being kept there because
   * R2 -- Cloudflare's actual file storage -- is not switched on for this
   * account. Twenty leaves room for the record itself.
   *
   * In practice that is something like fifteen seconds of 1080p off a phone, or
   * half a minute at 720p. The form says so plainly and tells people to trim
   * before sending, which every phone can do from the share sheet.
   *
   * When R2 is enabled this number goes away and the rest of this file barely
   * changes -- the queue, the approval and the serving all work the same.
   */
  videoBytes: 20_000_000,
};

export const KEYS = {
  one: (id) => 'crowd:' + id,
  pic: (id) => 'crowdpic:' + id,
  vid: (id) => 'crowdvid:' + id,
  live: 'crowd:live',
  pending: 'crowd:',
};

export const newId = () =>
  'c_' + Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((n) => n.toString(16).padStart(2, '0')).join('');

const clean = (value, limit) =>
  String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);

/* Newlines survive in the review itself -- somebody writing a paragraph or two
   should get their paragraphs -- but runs of blank lines do not. */
const cleanWords = (value) =>
  String(value == null ? '' : value)
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, LIMITS.words);

/* Out of five, or nothing. Anything that is not a whole number in range is
   treated as no rating rather than being rounded into one somebody did not give. */
export function cleanStars(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : 0;
}

/*
 * Is this actually an image, and one every phone can show?
 *
 * Checked by looking at the first few bytes rather than believing the
 * Content-Type, which is simply whatever the sender typed. A file that claims
 * to be a JPEG and is not gets turned away here rather than being stored and
 * served back to visitors later.
 */
export function imageKind(bytes) {
  const b = bytes;
  if (b.length < 12) { return ''; }

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) { return 'image/jpeg'; }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return 'image/webp';
  }

  return '';
}

/*
 * Is this a video, and one a browser stands a chance of playing?
 *
 * Read from the file's own first bytes, like the photographs, rather than from
 * whatever the sender's phone called it.
 *
 * Worth knowing: an iPhone set to "High Efficiency" records HEVC inside a .mov,
 * and that plays on Apple devices and often nowhere else. The file is accepted
 * -- it is genuine footage and the band will be looking at it on a phone -- but
 * it is the reason a clip can look fine in Backstage on an iPhone and refuse to
 * play for somebody on an Android. There is nothing this can do about that
 * without a transcoder, and there is no transcoder here.
 */
export function videoKind(bytes) {
  const b = bytes;
  if (b.length < 16) { return ''; }

  // ISO base media (mp4, m4v, mov): "ftyp" at offset 4
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === 'qt  ') { return 'video/quicktime'; }
    return 'video/mp4';
  }

  // Matroska / WebM: 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return 'video/webm';
  }

  return '';
}

/** Unpack a data URL into bytes, refusing anything oversized or malformed. */
export function bytesFromDataUrl(value) {
  const text = String(value || '');
  const comma = text.indexOf(',');
  if (comma < 0 || !/^data:image\//i.test(text)) { return null; }

  const base64 = text.slice(comma + 1);
  // 4 base64 characters carry 3 bytes; checked before decoding, not after
  if ((base64.length * 3) / 4 > LIMITS.photoBytes * 1.05) { return null; }

  let binary;
  try {
    binary = atob(base64);
  } catch (e) {
    return null;
  }
  if (binary.length > LIMITS.photoBytes) { return null; }

  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) { out[i] = binary.charCodeAt(i); }
  return out;
}

/** Put a submission into the shape that gets stored. Every field is named. */
export function tidy(input) {
  return {
    id: newId(),
    at: new Date().toISOString(),
    name: clean(input.name, LIMITS.name),
    town: clean(input.town, LIMITS.town),

    /*
     * Which gig this was, and roughly when. Asked for because a photograph
     * with no idea where it was taken is of very little use to anybody: the
     * band cannot caption it, it cannot be filed with the rest of that night,
     * and whoever adds it to the gallery has to guess at the alt text.
     */
    where: clean(input.where, LIMITS.where),
    when: clean(input.when, LIMITS.when),
    words: cleanWords(input.words),
    stars: cleanStars(input.stars),

    // all four set by the endpoint, once the bytes have been looked at
    photo: false,
    photoType: '',
    video: false,
    videoType: '',

    state: 'pending',
  };
}

/*
 * What the public is allowed to see of an approved submission.
 *
 * Built field by field from a named list rather than by removing the ones that
 * should not go out, so nothing added to a submission later can leak by having
 * been forgotten. The same approach as the gig list, for the same reason.
 */
export const forPublic = (item) => ({
  id: item.id,
  at: item.at,
  /*
   * Coerced rather than copied. A record approved before a field existed has
   * no value for it, JSON.stringify drops an undefined key entirely, and then
   * the page is reading a field that is not there. An empty string is the same
   * thing to everything that reads this and never catches anybody out.
   */
  name: item.name || '',
  town: item.town || '',
  where: item.where || '',
  when: item.when || '',
  words: item.words || '',
  stars: cleanStars(item.stars),
  photo: !!item.photo,
  video: !!item.video,
});

/*
 * A stored submission, filled out to the current shape.
 *
 * Records written before a field existed simply do not have it, and reading a
 * field that is not there is how a queue ends up showing "undefined out of 5".
 * Same reasoning as forPublic above: the difference is that this one keeps the
 * private fields, because Backstage is allowed to see them.
 */
export const forBand = (item) => ({
  ...item,
  name: item.name || '',
  town: item.town || '',
  where: item.where || '',
  when: item.when || '',
  words: item.words || '',
  stars: cleanStars(item.stars),
  photo: !!item.photo,
  video: !!item.video,
});

/** Everything the band have approved. */
export async function readLive(env) {
  if (!env.DIARY) { return []; }
  const live = await env.DIARY.get(KEYS.live, 'json');
  return Array.isArray(live) ? live : [];
}

export async function writeLive(env, list) {
  await env.DIARY.put(KEYS.live, JSON.stringify(list));
}
