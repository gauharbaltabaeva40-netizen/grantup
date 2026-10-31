import type messages from "../messages/kk.json";
import type { Locale } from "@/i18n/config";

// next-intl: аударма кілттерін типтеу (қате кілт жазсаңыз, TypeScript ескертеді)
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
