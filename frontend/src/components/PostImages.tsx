import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";

import { BrandElement } from "./BrandElement";

/**
 * The images of one postagem: the grid on the card, and the expanded view behind it. Both
 * `PostCard` and `PostDetail` render it, which is also why it exists — the two used to carry the
 * same `<img>` grid inline, and a change to how a postagem shows a photo had to be made twice.
 *
 * **The grid is a set of thumbnails, and it says so.** The 4/3 crop (E-13) is what keeps four
 * photos from turning a card into a column, but a crop is a promise that the whole picture is
 * somewhere — so every thumbnail is a button that opens it whole. The exception is a postagem with
 * a single image: with nothing to line up against, there is no reason to cut it at all, so it
 * shows in its own proportion up to a ceiling (see the CSS).
 *
 * **The expanded view is a native `<dialog>`, not a div with a high z-index.** `showModal()` is
 * what makes Escape close it, the page behind it inert, focus trapped inside and — the part that
 * matters here — the panel painted in the top layer, above `body::after`'s grain (base.css keeps
 * it at z-index 100, and nothing in normal flow gets past it). Returning focus to the thumbnail
 * that was clicked is the browser's job too.
 *
 * The image is `object-fit: contain` inside the viewport, never cropped and never enlarged past
 * its own pixels; what the member sees is the file as it was stored. A photo bigger than the
 * screen is still scaled down to fit it, so "Ver o arquivo original" opens the file itself — the
 * one thing this panel cannot promise on a 390px phone (DESIGN.md 8.5).
 *
 * Controls are the words "Anterior" and "Próxima" (DESIGN.md 6.3 rule 2), and the close is the `×`
 * of rule 3 — the fourth place that glyph is used, argued in DESIGN.md 6.3 and E-17.
 */
export function PostImages({
  images,
  authorName,
  className,
}: {
  images: string[];
  authorName: string;
  className?: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (openIndex !== null && !dialog.open) dialog.showModal();
    if (openIndex === null && dialog.open) dialog.close();
  }, [openIndex]);

  useEffect(() => {
    // showModal() makes the page inert but not unscrollable: without this, a flick on the scrim
    // scrolls the feed behind the photo.
    if (openIndex === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [openIndex]);

  if (images.length === 0) return null;

  const single = images.length === 1;

  function alt(index: number) {
    return `Imagem ${index + 1} da postagem de ${authorName}`;
  }

  function step(delta: number) {
    setOpenIndex((current) =>
      current === null ? current : (current + delta + images.length) % images.length,
    );
  }

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    // Escape is the dialog's own (it fires `close`, which clears the state below). These two are
    // what a member expects once a photo is open and there is more than one.
    if (images.length < 2) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  }

  function onDialogClick(event: MouseEvent<HTMLDialogElement>) {
    // The scrim is the dialog's own box, so a click that lands on the element itself — rather
    // than on the panel inside it — is a click outside the photo.
    if (event.target === dialogRef.current) setOpenIndex(null);
  }

  return (
    <>
      <div
        className={`post-card__images${single ? " post-card__images--single" : ""}${
          className ? ` ${className}` : ""
        }`}
      >
        {images.map((src, index) => (
          <button
            key={src}
            className="post-card__thumb"
            type="button"
            aria-label={`Ampliar a imagem ${index + 1} da postagem de ${authorName}`}
            onClick={() => setOpenIndex(index)}
          >
            <img src={src} alt={alt(index)} loading="lazy" />
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-label="Imagem da postagem"
        onClose={() => setOpenIndex(null)}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
      >
        {openIndex !== null ? (
          <div className="lightbox__panel">
            <div className="lightbox__bar">
              <p className="lightbox__count" aria-live="polite">
                {images.length > 1 ? `Imagem ${openIndex + 1} de ${images.length}` : null}
              </p>
              {/* The × of DESIGN.md 6.3 rule 3, the same file the shelf and the aviso use. */}
              <button
                className="lightbox__close"
                type="button"
                title="Fechar a imagem"
                aria-label="Fechar a imagem"
                onClick={() => setOpenIndex(null)}
              >
                <BrandElement name="x" />
              </button>
            </div>

            <img className="lightbox__image" src={images[openIndex]} alt={alt(openIndex)} />

            <div className="lightbox__foot">
              {images.length > 1 ? (
                <div className="lightbox__nav">
                  <button className="button button--quiet" type="button" onClick={() => step(-1)}>
                    ← Anterior
                  </button>
                  <button className="button button--quiet" type="button" onClick={() => step(1)}>
                    Próxima →
                  </button>
                </div>
              ) : null}
              <a
                className="lightbox__original"
                href={images[openIndex]}
                target="_blank"
                rel="noreferrer"
              >
                Ver o arquivo original
              </a>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
