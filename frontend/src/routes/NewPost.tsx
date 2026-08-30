import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { api } from "../api/client";
import type { Book, Post } from "../api/types";
import { BookPicker } from "../components/BookPicker";
import { BrandElement } from "../components/BrandElement";
import { useCurrentUser } from "../context/CurrentUser";

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * `/posts/new`. A post with images is N+1 requests: `POST /posts` creates it with `images: []`,
 * then each file is its own `POST /posts/{id}/images` — sequential, on purpose, so this single
 * uploader never collides with itself over the same position slot the way two concurrent tabs
 * could (backend answers that race with 409). The authoritative response is the *last* image
 * upload's `PostOut`, not the creation response, so that is what `createPost` returns.
 *
 * The functional core stays clean (DESIGN.md 7) — no collage on the form. `clips` is the one
 * brand element here, standing for "attach an image" per DESIGN.md 6.3.
 *
 * **Only the organisation writes** (`MeOut.is_staff`), and this screen turns a member away rather
 * than letting them fill in a form the API will refuse: `create_post` answers a plain member with
 * 403 whatever this file does, so rendering the fields would only be a promise nobody can keep.
 */
export function NewPost() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const [images, setImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);

  // Recomputed whenever the file list changes; the cleanup below revokes the previous batch, so
  // nothing leaks even though all four get a fresh URL on every add or remove.
  const previews = useMemo(() => images.map((file) => URL.createObjectURL(file)), [images]);
  useEffect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url);
    };
  }, [previews]);

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = ""; // lets the member pick the same file again after removing it
    if (selected.length === 0) return;

    const accepted: File[] = [];
    const problems: string[] = [];
    for (const file of selected) {
      if (images.length + accepted.length >= MAX_IMAGES) {
        problems.push(`No máximo ${MAX_IMAGES} imagens por postagem.`);
        break;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        problems.push(`"${file.name}" passa de 8 MB.`);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length > 0) setImages((prev) => [...prev, ...accepted]);
    setImageError(problems.length > 0 ? problems.join(" ") : null);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageError(null);
  }

  const createPost = useMutation({
    mutationFn: async () => {
      const created = await api<Post>("/posts", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          book_id: selectedBook?.id ?? null,
        }),
      });

      let latest = created;
      for (const file of images) {
        const formData = new FormData();
        formData.append("file", file);
        // Content-Type must be removed, not just left unset, so the browser writes the
        // multipart boundary itself — client.ts's default would otherwise ship
        // "application/json" on a form-data body.
        latest = await api<Post>(`/posts/${created.id}/images`, {
          method: "POST",
          headers: { "Content-Type": undefined },
          body: formData,
        });
      }
      return latest;
    },
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate(`/posts/${post.id}`);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      setFormError("Preencha o título e o texto da postagem.");
      return;
    }
    setFormError(null);
    createPost.mutate();
  }

  // After every hook, never before one: an early return above them would change the hook order
  // between renders.
  if (!me.is_staff) {
    return <Navigate to="/posts" replace />;
  }

  return (
    <section className="section">
      <div className="container">
        <h1 className="section-title">Nova postagem</h1>

        <form className="post-form" onSubmit={onSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="post-title">
              Título
            </label>
            <input
              id="post-title"
              className="field-text"
              type="text"
              maxLength={140}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="post-body">
              O que você quer contar?
            </label>
            <textarea
              id="post-body"
              className="field-textarea"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <BookPicker
              selected={selectedBook}
              onSelect={setSelectedBook}
              onClear={() => setSelectedBook(null)}
              label="Sobre qual livro? (opcional)"
            />
          </div>

          <div className="field">
            <label className="field-label" htmlFor="post-images">
              <BrandElement name="clips" />
              Anexar imagens (opcional — até 4 imagens de 8 MB cada)
            </label>
            <input
              id="post-images"
              className="field-file"
              type="file"
              accept="image/*"
              multiple
              onChange={onFilesSelected}
              disabled={images.length >= MAX_IMAGES}
            />
            {imageError ? (
              <p className="notice notice--error">
                <span className="notice__label">Não deu.</span> {imageError}
              </p>
            ) : null}
            {images.length > 0 ? (
              <ul className="image-picker__list">
                {images.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`} className="image-picker__item">
                    <img src={previews[index]} alt="" />
                    <button
                      type="button"
                      className="image-picker__remove"
                      onClick={() => removeImage(index)}
                      aria-label={`Remover imagem ${index + 1}`}
                    >
                      <BrandElement name="x" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div aria-live="polite">
            {formError ? (
              <p className="notice notice--error">
                <span className="notice__label">Não deu para postar.</span> {formError}
              </p>
            ) : null}
            {createPost.isError ? (
              <p className="notice notice--error">
                <span className="notice__label">Não deu para postar.</span>{" "}
                {createPost.error.message} Tente de novo.
              </p>
            ) : null}
          </div>

          <button className="button" type="submit" disabled={createPost.isPending}>
            {createPost.isPending ? "Postando…" : "Postar"}
          </button>
        </form>
      </div>
    </section>
  );
}
