import { BookOpen } from "lucide-react";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = () => placeholderMetadata("lessons");

export default function Page() {
  return <PlaceholderPage section="lessons" icon={BookOpen} />;
}
