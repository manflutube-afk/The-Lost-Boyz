/**
 * Telling the band something is waiting for them.
 *
 * Shared code, so it lives outside ./functions where Pages would make it a URL.
 *
 * What this email deliberately does not contain
 * --------------------------------------------
 * Anything the sender typed. Not their words, not their name, not the gig they
 * said it was.
 *
 * That is the whole point of the approval queue, and an email would go straight
 * round it. Something vile arrives, and a notification carrying it puts it in
 * the band's inbox with the sender's own words in the subject line -- past the
 * queue, past the approval, and in front of exactly the two people the queue
 * exists to protect. On a memorial site that is not a theoretical worry.
 *
 * So this says only what a machine knows: that something came in, what kind of
 * thing it was, and how many are waiting. Everything else is one tap away in
 * Backstage, where it can be looked at and then said yes or no to.
 *
 * Not too often, either
 * ---------------------
 * After a gig, ten people might send a photo within the hour. Ten emails is a
 * nuisance, and a nuisance gets filtered, and then the notification stops
 * working at all. One every quarter of an hour at most, and it says how many
 * are waiting so a quiet gap is never a missed message.
 */

const QUIET_MINUTES = 15;
const FLAG = 'notified:crowd';

const escapeHtml = (value) =>
  String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** How many are sitting in the queue right now. */
async function waitingCount(env) {
  try {
    const listed = await env.DIARY.list({ prefix: 'crowd:', limit: 1000 });
    // crowd:live is the approved record, not a submission
    return listed.keys.filter((k) => k.name !== 'crowd:live').length;
  } catch (e) {
    return 0;
  }
}

/** Has one gone out recently? Also claims the next slot if not. */
async function tooSoon(env) {
  try {
    if (await env.DIARY.get(FLAG)) { return true; }
    await env.DIARY.put(FLAG, '1', { expirationTtl: QUIET_MINUTES * 60 });
    return false;
  } catch (e) {
    // If the store cannot say, send it. A duplicate is better than a silence.
    return false;
  }
}

/**
 * Tell the band something has come in.
 *
 * `what` is a plain description built by the caller from flags it set itself --
 * "a photo", "a review and a video" -- never from anything typed by a sender.
 */
export async function tellTheBand(env, what, options) {
  const apiKey = env.RESEND_API_KEY;
  const to = env.BAND_EMAIL;
  if (!apiKey || !to || !env.DIARY) { return { sent: false, why: 'not configured' }; }

  /*
   * `force` is for somebody pressing a button in Backstage rather than a
   * submission arriving. The quiet window exists to stop a flood of automatic
   * emails; a deliberate press is not a flood, and being told "no, too soon"
   * when you have just asked for it would be nonsense.
   */
  if (!(options && options.force) && await tooSoon(env)) {
    return { sent: false, why: 'one went recently' };
  }

  const site = (env.SITE_URL || 'https://thelostboyz.uk').replace(/\/+$/, '');
  const link = site + '/admin';

  const waiting = await waitingCount(env);
  const queue = waiting > 1
    ? 'There are ' + waiting + ' waiting for you.'
    : 'It is the only one waiting.';

  const html =
    '<meta charset="utf-8">'
    + '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:16px;'
    + 'line-height:1.6;color:#222;max-width:520px">'
    + '<h1 style="font-size:20px;margin:0 0 14px">Check your Backstage</h1>'
    + '<p style="margin:0 0 16px">Somebody has sent in ' + escapeHtml(what)
    + ' through the website. ' + escapeHtml(queue) + '</p>'
    + '<p style="margin:0 0 22px">Nothing goes on the site until one of you has '
    + 'had a look and said yes.</p>'
    + '<p style="margin:0 0 24px">'
    + '<a href="' + link + '" style="display:inline-block;background:#7b3ff2;color:#fff;'
    + 'text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600">'
    + 'Open Backstage</a></p>'
    + '<p style="margin:0;color:#6b6478;font-size:13px">'
    + 'Or type it in: <a href="' + link + '" style="color:#6b6478">' + link + '</a><br>'
    + 'This message does not include what they sent, on purpose — have a look '
    + 'in Backstage and decide there.</p></div>';

  const text = [
    'Check your Backstage',
    '',
    'Somebody has sent in ' + what + ' through the website. ' + queue,
    'Nothing goes on the site until one of you has had a look and said yes.',
    '',
    link,
    '',
    'This message does not include what they sent, on purpose.',
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        // named, or an accented word arrives as mojibake
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL || 'The Lost Boyz <website@thelostboyz.uk>',
        to: [to],
        subject: 'Something is waiting in Backstage',
        html,
        text,
      }),
    });
    if (!res.ok) { return { sent: false, why: 'mail provider said ' + res.status }; }
    return { sent: true };
  } catch (e) {
    return { sent: false, why: 'send failed' };
  }
}
