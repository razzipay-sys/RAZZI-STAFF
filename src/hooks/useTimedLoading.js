import { useEffect, useState } from 'react';

export default function useTimedLoading(isLoading, timeoutMs = 6000) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setTimedOut(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [isLoading, timeoutMs]);

  return {
    timedOut,
    showLoader: isLoading && !timedOut,
  };
}
