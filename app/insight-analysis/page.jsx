import SectionPage from "@/components/SectionPage";
import { SECTION_MAP } from "@/lib/api";

export const revalidate = 300;
export const metadata = {
  title: "Insight Analysis — วิเคราะห์เจาะลึก",
  description: "Political Analysis · Economic Trends · Data Stories · Fact-Check · Investigative Reports",
};

export default function Page() {
  return <SectionPage section={SECTION_MAP["insight-analysis"]} />;
}
