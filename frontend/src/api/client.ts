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
    // through instead of inventing one at the component.
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new ApiError(response.status, body.detail ?? "Unexpected error");
  }

  // DELETE /api/posts/{id} answers 204 with no body. response.ok is true, but .json() on an
  // empty body throws "Unexpected end of JSON input" — which would report a successful delete
  // as a failed mutation.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
