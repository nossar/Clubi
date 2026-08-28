import { Link, Route, Routes } from "react-router-dom";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { CurrentUserProvider } from "./context/CurrentUser";
import { Home } from "./routes/Home";

/* Django's catch-all sends every path it does not own to this shell, so React Router has to
   answer for the ones it has no screen for. Fase 4 mounts only "/" — Feed, Perfil, Busca and the
   posts screens land in Fases 5 to 7. */
function NotFound() {
  return (
    <section className="section">
      <div className="container state">
        <h1 className="state__title">esta página ainda não existe</h1>
        <p>O endereço que você abriu não faz parte do site.</p>
        <p>
          <Link to="/">Voltar para o livro do mês</Link>
        </p>
      </div>
    </section>
  );
}

export function App() {
  return (
    <CurrentUserProvider>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </CurrentUserProvider>
  );
}
