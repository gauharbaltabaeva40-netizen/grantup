import { Trophy } from "lucide-react";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = () => placeholderMetadata("league");

export default function Page() {
  return <PlaceholderPage section="league" icon={Trophy} />;
}
