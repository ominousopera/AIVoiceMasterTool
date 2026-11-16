import { useEffect, useState } from "react";
import { getJsxLoadDiagnostics, subscribeJsxLoadError } from "./bolt";

/**
 * The ExtendScript load error, if any, shared by the main panel and the AE
 * Bridge panel. Reads the current state first (the load may already have
 * failed before the component mounted), then subscribes for a failure that
 * arrives later, with no time limit. The effect re-reads after subscribing to
 * close the gap between the first render and the subscription.
 */
export const useJsxLoadError = (): string | null => {
  const [error, setError] = useState<string | null>(() => getJsxLoadDiagnostics().error);
  useEffect(() => {
    const unsubscribe = subscribeJsxLoadError(setError);
    const now = getJsxLoadDiagnostics().error;
    if (now) setError(now);
    return unsubscribe;
  }, []);
  return error;
};
