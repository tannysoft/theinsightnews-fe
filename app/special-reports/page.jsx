import SectionPage from "@/components/SectionPage";
import { SECTION_MAP } from "@/lib/api";

export const revalidate = 300;
export const metadata = {
  title: "Special Reports — รายงานพิเศษ",
  description: "สารคดีข่าว · บทสัมภาษณ์เอ็กซ์คลูซีฟ · ซีรีส์เชิงหัวข้อ · งานวิจัย",
};

export default function Page() {
  return <SectionPage section={SECTION_MAP["special-reports"]} />;
}
