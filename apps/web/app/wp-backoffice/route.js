import { SITE } from "@/lib/site";
import { scrubCmsUrls } from "@/lib/urls";

/**
 * `/wp-backoffice` — WordPress' renamed login entry point, as it turns up on
 * the *frontend* host.
 *
 * WordPress builds login links from home_url(), which on this install is the
 * public site, so the links it hands out look like
 * `https://www.theinsightnews.co/wp-backoffice?redirect_to=<page>`. The login
 * form itself only exists on the CMS origin, so those URLs used to dead-end
 * in a 404 and swallow the page the visitor was actually going to. Requests
 * for `/wp-login.php` land here too: the CMS 301s that to /wp-backoffice, and
 * the old-slug resolver in app/[slug] follows it.
 *
 * So: honour the destination and send them there. `redirect_to` is the only
 * part of the URL that means anything on this host.
 */
export const dynamic = "force-dynamic";

/**
 * Resolve `redirect_to` to somewhere on this site, or fall back to the home
 * page.
 *
 * The validation is the point, not a formality — 301ing to whatever a query
 * parameter says is an open redirect, and a login-shaped URL is exactly the
 * bait a phishing link wants: theinsightnews.co/wp-backoffice?redirect_to=
 * <attacker>. Resolving against SITE.url and then insisting the origin still
 * matches rejects the lot in one check: other hosts, protocol-relative
 * `//evil.com`, and `javascript:` / `data:` (whose origin is null).
 *
 * CMS and legacy-apex URLs are mapped to their public equivalents first —
 * WordPress writes its own host into these links, and /tag/x on the CMS is
 * /tag/x here.
 */
function safeTarget(raw) {
  if (typeof raw !== "string" || raw.trim() === "") return SITE.url;
  try {
    const target = new URL(scrubCmsUrls(raw.trim()), SITE.url);
    return target.origin === new URL(SITE.url).origin ? target.toString() : SITE.url;
  } catch {
    return SITE.url;
  }
}

export async function GET(request) {
  const target = safeTarget(new URL(request.url).searchParams.get("redirect_to"));
  return new Response(null, {
    status: 301,
    headers: {
      Location: target,
      // The destination is carried in the query string, so a cached redirect
      // is keyed to it — but keep it short-lived anyway: this URL is a login
      // entry point, not a permanent home for any one page.
      "Cache-Control": "public, max-age=0, s-maxage=60",
    },
  });
}
