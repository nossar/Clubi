import { Link, Navigate, Route, Routes } from "react-router-dom";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { CurrentUserProvider } from "./context/CurrentUser";
import { EditProfile } from "./routes/EditProfile";
import { Feed } from "./routes/Feed";
import { Home } from "./routes/Home";
import { NewPost } from "./routes/NewPost";
import { PickHistory } from "./routes/PickHistory";
import { PostDetail } from "./routes/PostDetail";
import { Profile } from "./routes/Profile";
import { Search } from "./routes/Search";

/* Django's catch-all sends every path it does not own to this shell, so React Router has to
   answer for the ones it has no screen for. Since Fase 7 every route guide 7.4 lists is
   mounted, so what lands here is a typo or a dead link. */
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
          <Route path="/search" element={<Search />} />
          {/* Guide 7.4 also lists /book-of-the-month, but the Home already *is* that screen —
              it renders MonthlyPickHighlight, ProgressBar and ReadersList over the same pick.
              A second screen would be the near-copy 7.4 warns about two lines below the route
              table, so the documented URL redirects instead of being duplicated (and a member
              trimming /book-of-the-month/history in the address bar lands on the book, not on
              a 404). See frontend/CLAUDE.md for the full decision. */}
          <Route path="/book-of-the-month" element={<Navigate to="/" replace />} />
          <Route path="/book-of-the-month/history" element={<PickHistory />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </CurrentUserProvider>
  );
}
