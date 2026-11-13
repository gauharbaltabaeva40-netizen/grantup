"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Сертификат астындағы батырмалар (басып шығарғанда көрінбейді) */
export function CertificateActions({ url }: { url: string }) {
  const t = useTranslations("certificate");
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row print:hidden">
      <Button variant="brand" size="xl" className="flex-1" onClick={() => window.print()}>
        <Printer aria-hidden /> {t("print")}
      </Button>
      <Button
        variant="outline"
        size="xl"
        className="flex-1"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {}
        }}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? t("copied") : t("copy")}
      </Button>
    </div>
  );
}
