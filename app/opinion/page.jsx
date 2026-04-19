import SectionPage from "@/components/SectionPage";
import { SECTION_MAP } from "@/lib/api";

export const revalidate = 300;
export const metadata = {
  title: "Opinion — ทัศนะและมุมมอง",
  description: "Video Analysis · Podcast Inside Insight · Infographics · Photo Essays",
};

export default function Page() {
  return <SectionPage section={SECTION_MAP.opinion} />;
}
