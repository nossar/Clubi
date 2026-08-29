import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ApiError, api } from "../api/client";
import type { MonthlyPick } from "../api/types";
import { BrandElement } from "../components/BrandElement";
import { MonthlyPickHighlight } from "../components/MonthlyPickHighlight";
import { ProgressBar } from "../components/ProgressBar";
import { ReadersList } from "../components/ReadersList";
import { RecentPosts } from "../components/RecentPosts";

/** An empty screen is an invitation, not "nenhum registro encontrado" (DESIGN.md 9). */
function NoMonthlyPick() {
  return (
    <section className="pick section--invert on-invert">
      <div className="container state">
        <BrandElement name="nuvem" />
        <h1 className="state__title">ainda não há livro do mês</h1>
        <p>
          A escolha ainda não foi publicada. Assim que ela sair, o livro aparece aqui — com a
          sinopse e o prazo de leitura.
        </p>
        <p className="muted">Enquanto isso, vale terminar aquele que ficou pela metade.</p>
        <p>
          <Link to="/book-of-the-month/history">Ver as escolhas anteriores</Link>
        </p>
      </div>
    </section>
  );
}

export function Home() {
  const { data: pick, isPending, error } = useQuery({
    queryKey: ["monthly-pick", "current"],
    queryFn: () => api<MonthlyPick>("/monthly-picks/current"),
  });

  if (isPending) {
    return (
      <section className="section">
        <div className="container">
          <p className="muted">Carregando o livro do mês…</p>
        </div>
      </section>
    );
  }

  // A 404 here is not a fault: it means the club has not picked this month's book yet.
  if (error instanceof ApiError && error.status === 404) {
    return <NoMonthlyPick />;
  }

  if (error) {
    return (
      <section className="section">
        <div className="container">
          <p className="notice notice--error">
            <span className="notice__label">Não deu para carregar o livro do mês.</span>{" "}
            {error.message} Recarregue a página para tentar de novo.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <MonthlyPickHighlight pick={pick} />
      <ProgressBar pick={pick} />
      <ReadersList />
      <RecentPosts />
    </>
  );
}
