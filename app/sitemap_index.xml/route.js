// Alias for /sitemap.xml — Yoast's canonical path.
import { GET as IndexGET } from "../sitemap.xml/route";

export const revalidate = 1800;

export async function GET(request) {
  return IndexGET(request);
}
