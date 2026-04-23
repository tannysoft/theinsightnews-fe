import { revalidatePath } from "next/cache";
import { SITE } from "@/lib/site";

/**
 * On-demand cache flush — clears both layers:
 *   1) Next.js ISR cache in Workers KV (via revalidatePath)
 *   2) Cloudflare edge cache (via Cloudflare API purge-by-URL), if
 *      CLOUDFLARE_ZONE_ID + CLOUDFLARE_PURGE_TOKEN are configured.
 *
 * POST /api/revalidate
 *   Headers: x-revalidate-secret: <REVALIDATE_SECRET>
 *   Body: {
 *     "paths":        ["/some-slug"],          // revalidated with type: "page"
 *     "layoutPaths":  ["/category/politics"],  // revalidated with type: "layout"
 *                                              // (covers pagination / nested routes)
 *   }
 *
 * Legacy shapes still accepted:
 *   { "path": "/x" }
 *   { "paths": [...], "type": "layout" }
 */
export async function POST(req) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const pagePaths = Array.isArray(body.paths)
    ? [...body.paths]
    : body.path
      ? [body.path]
      : [];

  const layoutPaths = Array.isArray(body.layoutPaths) ? [...body.layoutPaths] : [];

  // Legacy: `type: "layout"` promotes everything in `paths` to layout.
  if (body.type === "layout") {
    layoutPaths.push(...pagePaths);
    pagePaths.length = 0;
  }

  if (!pagePaths.length && !layoutPaths.length) {
    return Response.json({ error: "no path(s) provided" }, { status: 400 });
  }

  for (const p of pagePaths) revalidatePath(p, "page");
  for (const p of layoutPaths) revalidatePath(p, "layout");

  const cloudflare = await purgeCloudflare([...pagePaths, ...layoutPaths]);

  return Response.json({
    revalidated: true,
    paths: pagePaths,
    layoutPaths,
    cloudflare,
  });
}

/**
 * Purge the Cloudflare edge cache for the given paths. Silently skipped
 * when the zone/token aren't configured so local dev still works.
 *
 * Purge-by-URL tops out at 30 URLs per request on non-Enterprise plans, so
 * we batch. For layout paths we can't enumerate paginated children
 * (`/page/2`, etc.) — the base URL is still worth purging since that's the
 * most-requested variant.
 */
async function purgeCloudflare(paths) {
  const zone = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_PURGE_TOKEN;
  if (!zone || !token) return { skipped: "not configured" };
  if (!paths.length) return { skipped: "no paths" };

  const base = (process.env.PURGE_BASE_URL || SITE.url).replace(/\/+$/, "");
  const urls = Array.from(new Set(paths.map((p) => base + (p.startsWith("/") ? p : "/" + p))));

  const results = [];
  for (let i = 0; i < urls.length; i += 30) {
    const batch = urls.slice(i, i + 30);
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ files: batch }),
        }
      );
      const json = await res.json().catch(() => ({}));
      results.push({ status: res.status, ok: !!json.success, errors: json.errors });
    } catch (e) {
      results.push({ status: 0, ok: false, errors: [{ message: String(e) }] });
    }
  }
  return { purged: urls, results };
}
