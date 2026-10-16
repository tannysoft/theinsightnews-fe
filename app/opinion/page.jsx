import SectionPage from "@/components/SectionPage";
import { SECTION_MAP } from "@/lib/api";
import { pageMetadata } from "@/lib/site";

export const revalidate = 300;
export const metadata = pageMetadata({
  path: "/opinion",
  title: "Opinion — ทัศนะและมุมมอง",
  description: "Video Analysis · Podcast Inside Insight · Infographics · Photo Essays",
});

export default function Page() {
  return <SectionPage section={SECTION_MAP.opinion} />;
}
