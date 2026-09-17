import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./client";

/* There is no jsdom in this project — the other two test files are pure functions — so the three
 * globals client.ts touches are stubbed by hand. That is cheaper than a DOM environment for what
 * is being checked here: the URL the 401 redirect builds, which is the ADR-05 login flow and the
 * one piece of client.ts that is not a fetch call. */
function browser({ pathname = "/", search = "" } = {}) {
  const assigned: string[] = [];
  vi.stubGlobal("location", { pathname, search });
  vi.stubGlobal("document", { cookie: "csrftoken=abc123" });
  vi.stubGlobal("window", {
    get location() {
      return {
        get href() {
          return "";
        },
        set href(value: string) {
          assigned.push(value);
        },
      };
    },
  });
  return assigned;
}

function respondWith(status: number, body: unknown = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the 401 redirect", () => {
  it("sends the member to the login page with where they were", async () => {
    const assigned = browser({ pathname: "/posts" });
    respondWith(401);

    await expect(api("/me")).rejects.toThrow();

    expect(assigned).toEqual(["/accounts/login/?next=%2Fposts"]);
  });

  it("keeps the query string, because it is part of where they were", async () => {
    // The bug this guards: /search?q=machado signed you in and dropped you on an empty /search.
    const assigned = browser({ pathname: "/search", search: "?q=machado" });
    respondWith(401);

    await expect(api("/users?q=machado")).rejects.toThrow();

    expect(assigned).toEqual(["/accounts/login/?next=%2Fsearch%3Fq%3Dmachado"]);
  });

  it("fires on a 401 from any call, not only from /api/me", async () => {
    const assigned = browser({ pathname: "/posts/7" });
    respondWith(401);

    await expect(api("/posts/7")).rejects.toThrow();

    expect(assigned).toHaveLength(1);
  });

  it("leaves a successful response alone", async () => {
    const assigned = browser({ pathname: "/posts" });
    respondWith(200, { total: 0 });

    await expect(api("/posts")).resolves.toEqual({ total: 0 });

    expect(assigned).toEqual([]);
  });
});
