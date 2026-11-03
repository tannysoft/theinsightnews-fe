import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { getPreviewPost } from "@/lib/api";

/**
 * Entry point for the CMS "Preview" button:
 * /api/preview?secret=…&id={postId}. Turns on draft mode and opens the
 * story at its URL, where the page reads the latest saved version.
 * /api/preview/exit turns it off again.
 */
export async function GET(req) {
  const url = new URL(req.url);
  const secret = process.env.PREVIEW_SECRET;
  const id = Number(url.searchParams.get("id"));
  if (!secret || url.searchParams.get("secret") !== secret || !Number.isInteger(id) || id <= 0) {
    return new Response("Invalid preview link", { status: 401 });
  }
  const post = await getPreviewPost({ id });
  if (!post?.slug) return new Response("Post not found (is CMS_PREVIEW_API_KEY set?)", { status: 404 });
  (await draftMode()).enable();
  redirect(`/${post.slug}`);
}
