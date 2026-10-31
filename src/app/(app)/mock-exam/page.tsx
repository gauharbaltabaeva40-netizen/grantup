import { ClipboardCheck } from "lucide-react";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = () => placeholderMetadata("mockExam");

export default function Page() {
  return <PlaceholderPage section="mockExam" icon={ClipboardCheck} />;
}
