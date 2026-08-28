import { useQuery } from "@tanstack/react-query";
import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import { ApiError, api } from "../api/client";
import type { User } from "../api/types";

const CurrentUserContext = createContext<User | null>(null);

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="splash">
      <span className="brand-mark" role="img" aria-label="clubi" />
      <p>{children}</p>
    </div>
  );
}

/**
 * Fetches GET /api/me once, at the root, and hands it down. That request is also the SPA's login
 * signal: a 401 makes client.ts point the browser at /accounts/login/?next=…, which is the whole
 * login flow (ADR-05). Nothing below this renders until we know who the member is.
 */
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/me"),
  });

  // A 401 is not a failure to report: the redirect is already under way, and this is what the
  // visitor sees for the instant before it lands.
  if (error instanceof ApiError && error.status === 401) {
    return <Splash>Levando você para a entrada…</Splash>;
  }

  if (error) {
    return (
      <Splash>
        Não deu para carregar a sua conta: {error.message} Recarregue a página para tentar de novo.
      </Splash>
    );
  }

  if (isPending) {
    return <Splash>Abrindo o clubi…</Splash>;
  }

  return <CurrentUserContext.Provider value={data}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): User {
  const user = useContext(CurrentUserContext);
  if (!user) {
    throw new Error("useCurrentUser needs a CurrentUserProvider above it");
  }
  return user;
}
