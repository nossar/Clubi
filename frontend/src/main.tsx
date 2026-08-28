import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { App } from "./App";
import "./styles/tokens.css";
import "./styles/base.css";

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

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
