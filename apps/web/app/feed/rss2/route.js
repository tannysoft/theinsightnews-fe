import { GET as FeedGET } from "../route";

// WordPress exposes the RSS 2.0 feed at both `/feed` and `/feed/rss2`.
export const revalidate = 900; // 15 min

export async function GET(request, context) {
  return FeedGET(request, context);
}
