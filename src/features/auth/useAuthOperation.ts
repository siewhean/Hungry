import { useEffect, useRef, useState } from "react";
import { beginAuthOperation } from "./authOperationState";
import { createExclusiveOperation } from "./exclusiveOperation";

export function useAuthOperation() {
  const mounted = useRef(true);
  const finishOperation = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useRef(
    createExclusiveOperation((value) => {
      if (value) finishOperation.current = beginAuthOperation();
      else {
        finishOperation.current?.();
        finishOperation.current = null;
      }
      if (mounted.current) setBusy(value);
    }),
  ).current;
  return { busy, run };
}
