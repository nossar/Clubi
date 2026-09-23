import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";

// Errors only, and no DSN means no SDK — `npm run dev` and `vitest` never reach the network
// (ADR-20). Session Replay is deliberately absent: it would record the member's screen, which
// on this site means resenhas being typed and other people's profiles being read.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // The browser twin of the backend's send_default_pii=False: no cookies, no IP, no
    // user identity attached to the event.
    sendDefaultPii: false,
    allowUrls: [/leiaclubi\.com\.br/],
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Not in the guide's snippet, and deliberate: this API's non-200s are states, not blips.
      // 404 on /monthly-picks/current means "no pick this month" and 401 has already sent the
      // browser to /accounts/login/ — retrying either only fires requests at a page that is
      // navigating away.
      retry: false,
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("The SPA shell is missing its #root element");

/* What a member sees when a render throws. Plain markup on the existing `.state` classes and a
   bare <a>, not <Link>: the boundary sits outside the router and the provider precisely so it
   still catches when one of those is what broke, so it must not depend on either. */
function Broken() {
  return (
    <main>
      <section className="section">
        <div className="container state">
          <h1 className="state__title">alguma coisa quebrou por aqui</h1>
          <p>
            O erro já foi registrado e a gente vai olhar. Recarregar a página costuma resolver.
          </p>
          <p>
            <a href="/">Voltar para o livro do mês</a>
          </p>
        </div>
      </section>
    </main>
  );
}

createRoot(root).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<Broken />}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
