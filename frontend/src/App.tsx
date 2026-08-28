import { Link, Route, Routes } from "react-router-dom";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { CurrentUserProvider } from "./context/CurrentUser";
import { EditProfile } from "./routes/EditProfile";
import { Feed } from "./routes/Feed";
import { Home } from "./routes/Home";
import { NewPost } from "./routes/NewPost";
import { PostDetail } from "./routes/PostDetail";
import { Profile } from "./routes/Profile";

/* Django's catch-all sends every path it does not own to this shell, so React Router has to
   answer for the ones it has no screen for. Fase 6 adds the profile screens; Busca and the
   book-of-the-month pages still land here until Fase 7. */
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
          <Route path="/posts" element={<Feed />} />
          <Route path="/posts/new" element={<NewPost />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </CurrentUserProvider>
  );
}
