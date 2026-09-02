import { useEffect, useState } from "react";

/**
 * The value, but only after it has stopped changing for `delay` ms.
 *
 * It exists so a `queryKey` built out of a text field fires one request per pause instead of one
 * per keystroke. Fase 5 wrote this inline in `BookPicker`; Fase 7 needed the same thing twice
 * more — the header's autocomplete and the `/search` screen — so it moved here rather than
 * being copied, for the same reason `initials()` left `ReadersList` in Fase 5.
 *
 * `delay` is a parameter and not a constant because the pause belongs to what is being searched,
 * not to the hook: `BookPicker` calls this twice on the same text, keeping the default for the
 * local acervo and asking for a much longer one for the external catalogue, whose request leaves
 * the building and can take seconds.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}
