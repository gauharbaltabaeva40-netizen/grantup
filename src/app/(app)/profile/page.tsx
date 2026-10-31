import { UserRound } from "lucide-react";
import { PlaceholderPage, placeholderMetadata } from "@/components/layout/placeholder-page";

export const generateMetadata = () => placeholderMetadata("profile");

export default function Page() {
  return <PlaceholderPage section="profile" icon={UserRound} />;
}
