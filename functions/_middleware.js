/**
 * Runs before everything else on the site. Two jobs.
 *
 * 1. Send www.thelostboyz.uk to thelostboyz.uk.
 * 2. Keep the band's diary at /admin behind a password.
 *
 * ---------------------------------------------------------------------------
 * The www redirect
 *
 * Both names serve the site, so without this the same pages sit at two
 * addresses. Search engines are already told which one counts -- every page
 * carries a canonical link naming the bare domain -- but a visitor can still
 * end up on either, and links get shared inconsistently.
 *
 * Why this is here in the code rather than a rule in the Cloudflare
 * dashboard: a redirect rule is the tidier place for it, because it runs at
 * the edge before Pages is involved at all and costs nothing. It needs
 * permissions on the zone that the deploy credentials do not have. This does
 * the same job from inside the project, at the cost of one Function
 * invocation per request. If a redirect rule is ever added in the dashboard,
 * delete that part of this file.
 *
 * A 301 rather than a 302: the move is permanent, and it is what passes the
 * search ranking of any www address on to the bare one.
 *
 * ---------------------------------------------------------------------------
 * The admin gate
 *
 * public/admin.html is an ordinary file in the published folder, which means
 * Pages would happily serve it to anybody who guessed the address. It does not,
 * because this middleware runs before the static files are reached and turns
 * an unauthenticated request for it into the sign-in page instead.
 *
 * That is the whole of the protection for the page itself, so the match below
 * is deliberately wide: /admin, /admin/, /admin.html and anything underneath.
 * The endpoints the page talks to do not rely on this at all -- each one checks
 * the cookie for itself, so a gap here could not expose the diary.
 */
import { isSignedIn } from '../lib/admin-auth.js';
import { signInResponse } from '../lib/sign-in-page.js';

const ADMIN_PATH = /^\/admin(?:\.html)?(?:\/|$)/i;

export async function onRequest(context) {
  const { request, next, env } = context;

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    // Should never happen, but a malformed URL must not take the site down:
    // hand it straight on and let Pages answer as it normally would.
    return next();
  }

  if (url.hostname.toLowerCase().startsWith('www.')) {
    url.hostname = url.hostname.slice(4);
    // Redirect() keeps the path, the query and the fragment as they are, so
    // www.thelostboyz.uk/sponsors lands on the sponsors page rather than the
    // front page.
    return Response.redirect(url.toString(), 301);
  }

  if (ADMIN_PATH.test(url.pathname)) {
    if (!env.ADMIN_PASSWORD) {
      return signInResponse(
        'No password has been set for the diary yet, so there is nothing to sign in to. '
        + 'Whoever looks after the website needs to set ADMIN_PASSWORD.', 503);
    }
    if (!(await isSignedIn(request, env))) {
      return signInResponse('', 401);
    }

    // Signed in. Let the page through, but never let it be cached -- not by
    // the browser, and not by anything in between.
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('Cache-Control', 'no-store, private');
    out.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return out;
  }

  return next();
}
