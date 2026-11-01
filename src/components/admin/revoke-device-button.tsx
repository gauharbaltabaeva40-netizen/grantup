"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { revokeDevice } from "@/lib/admin/actions";
import { useAdminAction } from "./use-admin-action";

export function RevokeDeviceButton({ deviceId }: { deviceId: string }) {
  const { pending, run } = useAdminAction();
  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (confirm("Құрылғыны өшіру керек пе? Оқушы осы құрылғыдан қайта растау сұрауы керек болады.")) {
          run(() => revokeDevice(deviceId), "Құрылғы өшірілді");
        }
      }}
    >
      <Trash2 aria-hidden /> Өшіру
    </Button>
  );
}
