import SectionPage from "@/components/SectionPage";
import { SECTION_MAP } from "@/lib/api";
import { pageMetadata } from "@/lib/site";

export const revalidate = 300;
export const metadata = pageMetadata({
  path: "/special-reports",
  title: "Special Reports — รายงานพิเศษ",
  description: "สารคดีข่าว · บทสัมภาษณ์เอ็กซ์คลูซีฟ · ซีรีส์เชิงหัวข้อ · งานวิจัย",
});

export default function Page() {
  return <SectionPage section={SECTION_MAP["special-reports"]} />;
}
