export function Footer() {
  return (
    // on-invert switches links and the focus ring to yellow, the only accent that survives
    // on wine (DESIGN.md 3.2).
    <footer className="site-footer on-invert">
      <div className="container site-footer__inner">
        <span className="brand-mark site-footer__brand" role="img" aria-label="clubi" />
        {/* Straight from the club's own pieces (DESIGN.md 9) — the tone the whole site answers to. */}
        <p className="site-footer__note">
          Aqui não importa quantos livros você lê por ano. O que importa é fazer parte.
        </p>
        <p className="muted">clube do livro da ESPM · criado por estudantes para estudantes</p>
      </div>
    </footer>
  );
}
