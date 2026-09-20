import { useEffect, useState } from "react";

const DEFAULT_DEBOUNCE_MS = 400;

export function useDebounced<T>(value: T, delayMs = DEFAULT_DEBOUNCE_MS): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    if (value === "" || value === debouncedValue) {
      setDebouncedValue(value);
      return;
    }

    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, debouncedValue]);

  return debouncedValue;
}
