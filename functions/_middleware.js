/**
 * Send www.thelostboyz.uk to thelostboyz.uk.
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
 * delete this file.
 *
 * A 301 rather than a 302: the move is permanent, and it is what passes the
 * search ranking of any www address on to the bare one.
 */
export async function onRequest(context) {
  const { request, next } = context;

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

  return next();
}
