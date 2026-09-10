/**
 * Enquiry endpoint for the booking form and the sponsor form.
 *
 * This is a Cloudflare Pages Function: it lives outside ./public, so it is
 * never served as a file, and Pages runs it at /api/enquiry.
 *
 * It does two things with a valid enquiry -- email it to the band, and email a
 * confirmation to whoever sent it. Both go through Resend, whose API key is
 * held as a Cloudflare secret and never appears in the repository or in
 * anything the browser can see.
 *
 * Configure in the Cloudflare dashboard under
 * Workers & Pages -> the-lost-boyz -> Settings -> Variables and Secrets:
 *
 *   RESEND_API_KEY  (secret)  the API key from resend.com
 *   BAND_EMAIL      (plain)   where enquiries go, e.g. bookings@thelostboyz.uk
 *   FROM_EMAIL      (plain)   the verified sender, e.g. website@thelostboyz.uk
 *
 * Until RESEND_API_KEY is set this returns 503 with a clear reason, and the
 * page falls back to opening the visitor's own email app with the enquiry
 * already written out -- so an enquiry is never simply lost.
 */

const MAX = { name: 120, email: 200, phone: 60, text: 4000 };

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clean = (value, limit) =>
  String(value == null ? '' : value).trim().slice(0, limit);

const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const json = (body, status) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const rowsHtml = (fields, labelColour, valueColour) =>
  fields
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        '<tr><td style="padding:6px 14px 6px 0;color:' + labelColour +
        ';white-space:nowrap;vertical-align:top">' + escapeHtml(label) + '</td>' +
        '<td style="padding:6px 0;color:' + valueColour +
        ';white-space:pre-wrap">' + escapeHtml(value) + '</td></tr>'
    )
    .join('');

/*
 * The masthead.
 *
 * The logo on this site is pale line-work made for a dark page, and email is
 * read on white -- dropped in as-is it would all but vanish. The image built by
 * the build script has the dark ground baked into it, so it reads the same
 * wherever it lands, and it is a PNG because Outlook still does not do webp.
 *
 * It is served at twice the size it is shown at, so it stays sharp on a phone,
 * and it carries alt text because most mail clients block images until asked.
 */
function masthead(siteUrl) {
  return (
    '<tr><td style="padding:0">' +
    '<img src="' + siteUrl + '/images/email-header.png" width="600" height="200" ' +
    'alt="The Lost Boyz" ' +
    'style="display:block;width:100%;max-width:600px;height:auto;border:0;background:#170b26"></td></tr>'
  );
}

/*
 * A table, not a div. Every mail client renders tables; rather fewer of them
 * render modern layout, and Outlook in particular still lays out with Word.
 */
function wrapEmail(siteUrl, inner) {
  return (
    // stated in the message too, because some mail clients read this rather
    // than the MIME header
    '<meta charset="utf-8">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
    'style="background:#f4f1f7;padding:24px 12px">' +
    '<tr><td align="center">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" ' +
    'style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">' +
    masthead(siteUrl) +
    '<tr><td style="padding:26px 26px 30px;font-family:system-ui,Segoe UI,Arial,sans-serif;' +
    'font-size:15px;line-height:1.6;color:#222">' + inner + '</td></tr>' +
    '</table>' +
    '<p style="margin:14px 0 0;font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:12px;color:#8a8397">' +
    'The Lost Boyz &middot; classic rock duo &middot; Cornwall</p>' +
    '</td></tr></table>'
  );
}

/* A plain-text version of the same thing, for clients that want one. */
function textOf(lines) {
  return lines.filter(Boolean).join('\n');
}

/* The band's copy of the enquiry: every field, in the order it was asked. */
function bandEmail(kind, fields, replyTo, siteUrl) {
  const heading = kind === 'sponsor' ? 'Sponsor enquiry' : 'Booking enquiry';

  const inner =
    '<h1 style="margin:0 0 16px;font-size:20px;letter-spacing:.02em">' + heading + '</h1>' +
    '<table role="presentation" style="border-collapse:collapse">' +
    rowsHtml(fields, '#6b6478', '#111') + '</table>' +
    '<p style="margin:20px 0 0;color:#6b6478;font-size:13px">Sent from the website. ' +
    'Reply straight to this email to answer them.</p>';

  return {
    subject: heading + ' from ' + replyTo,
    html: wrapEmail(siteUrl, inner),
    text: textOf([
      heading,
      '',
      ...fields.filter(([, v]) => v).map(([label, value]) => label + ': ' + value),
      '',
      'Sent from the website. Reply to this email to answer them.',
    ]),
  };
}

/* Their copy: short, warm, and a record of what they actually sent. */
function confirmationEmail(kind, fields, name, siteUrl) {
  const opening =
    kind === 'sponsor'
      ? 'Thank you for thinking about sponsoring us \u2014 it genuinely helps keep the show on the road.'
      : 'Thank you for getting in touch about a booking.';

  const inner =
    '<p style="margin:0 0 14px">' + (name ? 'Hello ' + escapeHtml(name) + ',' : 'Hello,') + '</p>' +
    '<p style="margin:0 0 16px">' + opening +
    ' Your message has come through and one of us will get back to you dreckly.</p>' +
    '<p style="margin:0 0 8px;color:#6b6478;font-size:13px">Here is what you sent:</p>' +
    '<table role="presentation" style="border-collapse:collapse;margin:0 0 20px">' +
    rowsHtml(fields, '#6b6478', '#222') + '</table>' +
    '<p style="margin:0 0 16px">If anything above is wrong, just reply to this email and tell us.</p>' +
    '<p style="margin:0">Cheers,<br>Darren &amp; Andrew</p>';

  return {
    subject:
      kind === 'sponsor'
        ? 'Thanks for your sponsorship enquiry \u2014 The Lost Boyz'
        : 'Thanks for your booking enquiry \u2014 The Lost Boyz',
    html: wrapEmail(siteUrl, inner),
    text: textOf([
      name ? 'Hello ' + name + ',' : 'Hello,',
      '',
      opening + ' Your message has come through and one of us will get back to you dreckly.',
      '',
      'Here is what you sent:',
      ...fields.filter(([, v]) => v).map(([label, value]) => label + ': ' + value),
      '',
      'If anything above is wrong, just reply to this email and tell us.',
      '',
      'Cheers,',
      'Darren & Andrew',
    ]),
  };
}

async function send(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      /*
       * The charset is not optional here.
       *
       * Without it, an em-dash typed into the form arrived at the far end as
       * "a-euro-quote": the body goes out as UTF-8, and a receiver with no
       * charset to go on falls back to Latin-1 and reads each byte as its own
       * character. Naming it costs nothing and fixes every accented name,
       * curly quote and dash anyone types into either form.
       */
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // The provider's error body can echo the request back, so it is not
    // passed on -- only the status, which is enough to tell what went wrong.
    throw new Error('mail provider returned ' + res.status);
  }
  return res.json();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ ok: false, error: 'Could not read that.' }, 400);
  }

  // A field no person ever sees, and so no person ever fills in. Bots do.
  // Answered with a cheerful 200 so the sender learns nothing from failing.
  if (clean(body.website, 200)) { return json({ ok: true }, 200); }

  const kind = body.kind === 'sponsor' ? 'sponsor' : 'booking';
  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);

  if (!name || !email) {
    return json({ ok: false, error: 'Please give us your name and an email address.' }, 400);
  }
  if (!looksLikeEmail(email)) {
    return json({ ok: false, error: 'That email address does not look right.' }, 400);
  }

  const fields =
    kind === 'sponsor'
      ? [
          ['Plan', clean(body.plan, MAX.name)],
          ['Business', clean(body.business, MAX.name)],
          ['Name', name],
          ['Email', email],
          ['Phone', clean(body.phone, MAX.phone)],
          ['Message', clean(body.message, MAX.text)],
        ]
      : [
          ['Enquiry from', clean(body.who, MAX.name)],
          ['Business', clean(body.business, MAX.name)],
          ['Name', name],
          ['Email', email],
          ['Phone', clean(body.phone, MAX.phone)],
          ['Kind of do', clean(body.occasion, MAX.name)],
          ['Date', clean(body.date, MAX.name)],
          ['Venue or town', clean(body.venue, MAX.name)],
          ['Details', clean(body.message, MAX.text)],
        ];

  const apiKey = env.RESEND_API_KEY;
  const bandTo = env.BAND_EMAIL || 'bookings@thelostboyz.uk';
  const from = env.FROM_EMAIL || 'The Lost Boyz <website@thelostboyz.uk>';
  // where the logo in the email is fetched from. Change this to
  // https://thelostboyz.uk once the domain points at the site.
  const siteUrl = (env.SITE_URL || 'https://the-lost-boyz.pages.dev').replace(/\/+$/, '');

  if (!apiKey) {
    return json(
      { ok: false, reason: 'not-configured', error: 'Email sending is not switched on yet.' },
      503
    );
  }

  const forBand = bandEmail(kind, fields, email, siteUrl);

  try {
    // The band's copy is the one that matters, so it is sent and checked
    // first. If it fails the visitor is told, and the page falls back to
    // their own email app rather than pretending the enquiry got through.
    await send(apiKey, {
      from: from,
      to: [bandTo],
      reply_to: email,
      subject: forBand.subject,
      html: forBand.html,
      text: forBand.text,
    });
  } catch (e) {
    return json({ ok: false, error: 'That did not send. Please try again in a moment.' }, 502);
  }

  // Their receipt. A failure here must not tell them the enquiry failed,
  // because it did not -- the band already has it.
  try {
    const receipt = confirmationEmail(kind, fields, name, siteUrl);
    await send(apiKey, {
      from: from,
      to: [email],
      reply_to: bandTo,
      subject: receipt.subject,
      html: receipt.html,
      text: receipt.text,
    });
  } catch (e) {
    return json({ ok: true, confirmation: false }, 200);
  }

  return json({ ok: true, confirmation: true }, 200);
}

/* Anything that is not a POST gets a plain answer rather than a stack trace. */
export async function onRequest(context) {
  if (context.request.method === 'POST') { return onRequestPost(context); }
  return json({ ok: false, error: 'Send this a POST.' }, 405);
}
