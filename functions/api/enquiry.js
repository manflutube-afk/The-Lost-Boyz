/**
 * Enquiry endpoint for the booking form and the sponsor form.
 *
 * This is a Cloudflare Pages Function: it lives outside ./public, so it is
 * never served as a file, and Pages runs it at /api/enquiry.
 *
 * It does two things with a valid enquiry — email it to the band, and email a
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
 * already written out — so an enquiry is never simply lost.
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

/* The band's copy of the enquiry: every field, in the order it was asked. */
function bandEmail(kind, fields, replyTo) {
  const heading = kind === 'sponsor' ? 'Sponsor enquiry' : 'Booking enquiry';

  return {
    subject: heading + ' from ' + replyTo,
    html:
      '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px">' +
      '<h2 style="margin:0 0 14px">' + heading + '</h2>' +
      '<table style="border-collapse:collapse">' + rowsHtml(fields, '#666', '#111') + '</table>' +
      '<p style="margin:18px 0 0;color:#666;font-size:13px">Sent from thelostboyz.uk. ' +
      'Reply straight to this email to answer them.</p></div>',
  };
}

/* Their copy: short, warm, and a record of what they actually sent. */
function confirmationEmail(kind, fields, name) {
  const opening =
    kind === 'sponsor'
      ? 'Thank you for thinking about sponsoring us — it genuinely helps keep the show on the road.'
      : 'Thank you for getting in touch about a booking.';

  return {
    subject:
      kind === 'sponsor'
        ? 'Thanks for your sponsorship enquiry — The Lost Boyz'
        : 'Thanks for your booking enquiry — The Lost Boyz',
    html:
      '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;font-size:15px;color:#222;max-width:560px">' +
      '<h2 style="margin:0 0 6px;letter-spacing:.04em">THE LOST BOYZ</h2>' +
      '<p style="margin:0 0 18px;color:#777;font-size:13px">Classic rock duo &middot; Cornwall</p>' +
      '<p style="margin:0 0 14px">' + (name ? 'Hello ' + escapeHtml(name) + ',' : 'Hello,') + '</p>' +
      '<p style="margin:0 0 14px">' + opening +
      ' Your message has come through and one of us will get back to you dreckly.</p>' +
      '<p style="margin:0 0 8px;color:#777;font-size:13px">Here is what you sent:</p>' +
      '<table style="border-collapse:collapse;margin:0 0 18px">' + rowsHtml(fields, '#777', '#222') + '</table>' +
      '<p style="margin:0 0 14px">If anything above is wrong, just reply to this email and tell us.</p>' +
      '<p style="margin:0">Cheers,<br>Darren &amp; Andrew</p></div>',
  };
}

async function send(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // The provider's error body can echo the request back, so it is not
    // passed on — only the status, which is enough to tell what went wrong.
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

  if (!apiKey) {
    return json(
      { ok: false, reason: 'not-configured', error: 'Email sending is not switched on yet.' },
      503
    );
  }

  const forBand = bandEmail(kind, fields, email);

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
    });
  } catch (e) {
    return json({ ok: false, error: 'That did not send. Please try again in a moment.' }, 502);
  }

  // Their receipt. A failure here must not tell them the enquiry failed,
  // because it did not — the band already has it.
  try {
    const receipt = confirmationEmail(kind, fields, name);
    await send(apiKey, {
      from: from,
      to: [email],
      reply_to: bandTo,
      subject: receipt.subject,
      html: receipt.html,
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
