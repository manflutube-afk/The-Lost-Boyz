/**
 * The way in to Backstage, the band's own page.
 *
 * Two places need to draw this page -- the middleware, when somebody asks for
 * /admin without a session, and the login endpoint, when the password typed
 * into it was wrong -- so it lives here rather than in either of them. Keeping
 * it out of ./functions matters for a second reason: a route module that
 * imports another route module is a knot the Pages build does not need, and
 * shared code belongs outside the folder that becomes URLs.
 *
 * It is deliberately plain. No stylesheet, no script, nothing fetched from
 * anywhere else, so the door still works on a bad connection or when something
 * about the rest of the site is broken.
 */

const escape = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function page(message) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Backstage &mdash; The Lost Boyz</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; min-height: 100svh; display: grid; place-items: center;
         background: #07040c; color: #efeaf6; padding: 24px;
         font: 16px/1.6 system-ui, "Segoe UI", Arial, sans-serif; }
  form { width: 100%; max-width: 340px; }
  h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .02em; }
  p.sub { margin: 0 0 22px; color: #a99fbd; font-size: 14px; }
  label { display: block; font-size: 13px; color: #a99fbd; margin: 0 0 6px; }
  input { width: 100%; box-sizing: border-box; padding: 12px 14px; font-size: 16px;
          color: #efeaf6; background: #150c24; border: 1px solid #3c2b59;
          border-radius: 10px; }
  input:focus { outline: 2px solid #9a5cff; outline-offset: 1px; }
  button { width: 100%; margin: 14px 0 0; padding: 12px 14px; font-size: 16px;
           font-weight: 600; color: #fff; background: #7b3ff2; border: 0;
           border-radius: 10px; cursor: pointer; }
  button:hover { background: #8d55ff; }
  .err { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; font-size: 14px;
         background: #3a1020; border: 1px solid #7d2540; color: #ffc9d6; }
  a { color: #b98cff; font-size: 13px; }
  .back { display: block; margin: 20px 0 0; text-align: center; }
</style>
</head>
<body>
<form method="post" action="/api/admin/login">
  <h1>Backstage</h1>
  <p class="sub">Darren and Andrew only.</p>
  ${message ? `<p class="err">${escape(message)}</p>` : ''}
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password"
         autofocus required>
  <button type="submit">Sign in</button>
  <a class="back" href="/">Back to the website</a>
</form>
</body>
</html>`;
}

/** The sign-in page, as a response. */
export function signInResponse(message, status) {
  return new Response(page(message || ''), {
    status: status || 401,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // nothing here should ever end up in a search engine
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
