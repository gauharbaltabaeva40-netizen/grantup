import { getTranslations } from "next-intl/server";
import { DeviceGate } from "@/components/auth/device-gate";
import { safeNext } from "@/config/routes";

export async function generateMetadata() {
  const t = await getTranslations("device");
  return { title: t("title"), robots: { index: false } };
}

export default async function DevicePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  return <DeviceGate next={target === "/device" ? "/" : target} />;
}
