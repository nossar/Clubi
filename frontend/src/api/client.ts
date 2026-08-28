/* The only file in the frontend that talks to the network (guide 7.2).
 *
 * It carries two project rules that a generated client would have turned into interceptor
 * config (ADR-16c): the X-CSRFToken header read from the cookie, and the 401 redirect to
 * /accounts/login/ — which *is* the login flow, since the SPA has no login screen (ADR-05).
 *
 * Components go through TanStack Query and never call fetch, axios or an absolute URL. If a
 * response ever comes back as the SPA shell's HTML, the path is wrong: the catch-all in
 * clubi/urls.py excludes api/ on purpose. */

/** The cookie Django set on the shell response (clubi/urls.py wraps it in ensure_csrf_cookie). */
export function csrfToken(): string {
  return document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
}

/**
 * Ninja's own 4xx bodies are `{ "detail": "..." }` and already written in pt-BR, so they are
 * carried through untouched. Pydantic's 422 is a different shape: `detail` is an *array* of
 * validation objects (`{type, loc, msg}`) whose `msg` is English and talks about `loc` and
 * `ctx`. Coercing that into an `Error` message printed a literal "[object Object]" on screen.
 *
 * The screens are written so a 422 is unreachable — the shelf locks at four slots and builds its
 * own positions (Fase 6) — but if one ever escapes, the member should read a Portuguese sentence
 * rather than a Pydantic trace.
 */
function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return "Os dados enviados não foram aceitos.";
  return "Não deu para completar a ação.";
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * `init.headers` widens past `RequestInit`'s `HeadersInit` so a caller can pass
 * `{ "Content-Type": undefined }` to *remove* the default JSON header — needed for
 * multipart uploads (Fase 5), where the browser must write its own `boundary`. A plain object
 * spread can't do that: `{ ...defaults, "Content-Type": undefined }` still has the key, and
 * `fetch` stringifies that to the literal `"undefined"`. Building a `Headers` object and
 * `.delete()`-ing on `undefined` is what actually removes it.
 */
export async function api<T>(
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: Record<string, string | undefined> } = {},
): Promise<T> {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-CSRFToken": csrfToken(),
  });
  for (const [key, value] of Object.entries(init.headers ?? {})) {
    if (value === undefined) {
      headers.delete(key);
    } else {
      headers.set(key, value);
    }
  }

  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  if (response.status === 401) {
    const next = encodeURIComponent(location.pathname);
    window.location.href = `/accounts/login/?next=${next}`;
    throw new ApiError(401, "Not authenticated");
  }

  if (!response.ok) {
    // Errors are { "detail": "..." } and already written in Portuguese: carry the message
    // through instead of inventing one at the component. See detailMessage for the one shape
    // that is not a string — Pydantic's 422.
    const body = (await response.json().catch(() => ({}))) as { detail?: unknown };
    throw new ApiError(response.status, detailMessage(body.detail));
  }

  // DELETE /api/posts/{id} answers 204 with no body. response.ok is true, but .json() on an
  // empty body throws "Unexpected end of JSON input" — which would report a successful delete
  // as a failed mutation.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
