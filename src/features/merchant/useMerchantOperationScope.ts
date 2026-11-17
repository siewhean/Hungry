import { useEffect, useRef } from "react";
import { useProfileStore } from "@/store/useProfileStore";
import { useMerchantStore } from "@/store/useMerchantStore";
import { createMerchantOperationScope } from "./operationScope";

function identity() {
  const merchant = useMerchantStore.getState();
  return `${useProfileStore.getState().profile.id}:${merchant.activeOutletId ?? ""}`;
}
export function useMerchantOperationScope() {
  const scope = useRef(createMerchantOperationScope(identity()));
  scope.current.update(identity());
  useEffect(() => {
    const current = scope.current;
    current.open();
    const update = () => current.update(identity());
    const profile = useProfileStore.subscribe(update);
    const merchant = useMerchantStore.subscribe(update);
    return () => {
      profile();
      merchant();
      current.close();
    };
  }, []);
  const renderedIdentity = identity();
  return () => {
    scope.current.update(identity());
    const current = scope.current.capture();
    return () => current() && identity() === renderedIdentity;
  };
}
