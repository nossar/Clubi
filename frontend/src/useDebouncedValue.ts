import { useEffect, useState } from "react";

/**
 * The value, but only after it has stopped changing for `delay` ms.
 *
 * It exists so a `queryKey` built out of a text field fires one request per pause instead of one
 * per keystroke. Fase 5 wrote this inline in `BookPicker`; Fase 7 needed the same thing twice
 * more — the header's autocomplete and the `/search` screen — so it moved here rather than
 * being copied, for the same reason `initials()` left `ReadersList` in Fase 5.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}
