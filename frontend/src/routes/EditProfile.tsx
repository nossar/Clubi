import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "../api/client";
import type { Me, ProfilePatch } from "../api/types";
import { FavoritesShelf } from "../components/FavoritesShelf";
import { useCurrentUser } from "../context/CurrentUser";
import { initials } from "../format";

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

// The column widths of users.User, which ProfileIn declares as max_length and PatchDict then
// drops on the floor — see the note in frontend/CLAUDE.md. Today these two numbers are the only
// length validation in the whole path.
const MAX_NAME = 120;
const MAX_QUOTE = 180;

/**
 * `/profile/edit`. Three writes live here, and they are deliberately three separate requests
 * rather than one form submit:
 *
 * - `PATCH /api/me` for the text fields.
 * - `PUT /api/me/photo`, which is multipart on a PUT — it only works because
 *   `ninja.compatibility.files.fix_request_files_middleware` is in `MIDDLEWARE`, and it needs
 *   `Content-Type` *removed* so the browser writes its own boundary (the Fase 5 path).
 * - `PUT /api/me/favorites`, inside `FavoritesShelf`, which replaces the shelf whole (ADR-08).
 *
 * There is no "Remover foto": `upload_photo` only writes, and `ProfileIn` has no `photo` field,
 * so the API cannot express it. A button that silently did nothing would be worse than its
 * absence.
 *
 * Clearing works differently per field, and the asymmetry is the API's: `update_me` turns a null
 * into `""` for every field *except* `birth_date`, the one genuinely nullable column. So an
 * emptied `<input type="date">` — which reads `""` — has to be sent as `null`, or `date | None`
 * refuses to parse it and answers 422.
 */
export function EditProfile() {
  const me = useCurrentUser();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(me.full_name);
  const [quote, setQuote] = useState(me.quote);
  const [birthDate, setBirthDate] = useState(me.birth_date ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function invalidateMe() {
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["user", me.username] });
  }

  const saveProfile = useMutation({
    mutationFn: (payload: ProfilePatch) =>
      api<Me>("/me", { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: invalidateMe,
  });

  const savePhoto = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api<Me>("/me/photo", {
        method: "PUT",
        headers: { "Content-Type": undefined },
        body: formData,
      });
    },
    onSuccess: () => {
      setPhoto(null);
      invalidateMe();
    },
  });

  function onPhotoSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = ""; // lets the same file be picked again after an error
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES) {
      setPhoto(null);
      setPhotoError(`"${file.name}" passa de 8 MB. Escolha uma imagem menor.`);
      return;
    }
    setPhotoError(null);
    setPhoto(file);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = fullName.trim();
    if (!name) {
      setFormError("O nome não pode ficar em branco.");
      return;
    }
    setFormError(null);

    // Only changed fields travel: an untouched field left out of a PatchDict is left alone.
    const payload: ProfilePatch = {};
    if (name !== me.full_name) payload.full_name = name;
    if (quote.trim() !== me.quote) payload.quote = quote.trim();
    const nextBirthDate = birthDate || null;
    if (nextBirthDate !== me.birth_date) payload.birth_date = nextBirthDate;

    if (Object.keys(payload).length === 0) return;
    saveProfile.mutate(payload);
  }

  const unchanged =
    fullName.trim() === me.full_name &&
    quote.trim() === me.quote &&
    (birthDate || null) === me.birth_date;

  return (
    <>
      <section className="section">
        <div className="container">
          <p>
            <Link to={`/u/${me.username}`}>← Voltar para o meu perfil</Link>
          </p>

          <h1 className="section-title">Editar perfil</h1>

          <form className="post-form" onSubmit={onSubmit}>
            <div className="field">
              <label className="field-label" htmlFor="profile-name">
                Seu nome
              </label>
              <input
                id="profile-name"
                className="field-text"
                type="text"
                maxLength={MAX_NAME}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-quote">
                Uma frase sua
              </label>
              <input
                id="profile-quote"
                className="field-text"
                type="text"
                maxLength={MAX_QUOTE}
                value={quote}
                onChange={(event) => setQuote(event.target.value)}
                aria-describedby="profile-quote-help"
              />
              <p className="muted field-help" id="profile-quote-help">
                Aparece no seu perfil, embaixo do seu nome. Até {MAX_QUOTE} caracteres —{" "}
                {quote.length} usados.
              </p>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="profile-birth">
                Data de nascimento (opcional)
              </label>
              <input
                id="profile-birth"
                className="field-text"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
              />
            </div>

            <div aria-live="polite">
              {formError ? (
                <p className="notice notice--error">
                  <span className="notice__label">Não deu para salvar.</span> {formError}
                </p>
              ) : null}
              {saveProfile.isError ? (
                <p className="notice notice--error">
                  <span className="notice__label">Não deu para salvar.</span>{" "}
                  {saveProfile.error.message} Ajuste e tente de novo.
                </p>
              ) : null}
              {saveProfile.isSuccess && unchanged ? (
                <p className="notice notice--ok">
                  <span className="notice__label">Perfil salvo.</span> É assim que o clube vê
                  você.
                </p>
              ) : null}
            </div>

            <button className="button" type="submit" disabled={unchanged || saveProfile.isPending}>
              {saveProfile.isPending ? "Salvando…" : "Salvar perfil"}
            </button>
          </form>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Sua foto</h2>

          <div className="photo-form">
            {me.photo ? (
              <img className="profile-photo" src={me.photo} alt="Sua foto atual" />
            ) : (
              <span className="profile-photo profile-photo--blank" aria-hidden="true">
                {initials(me.full_name || me.username)}
              </span>
            )}

            <div className="photo-form__controls">
              <label className="field-label" htmlFor="profile-photo">
                Escolher uma imagem (até 8 MB)
              </label>
              <input
                id="profile-photo"
                className="field-file"
                type="file"
                accept="image/*"
                onChange={onPhotoSelected}
              />
              {photo ? <p className="muted field-help">Selecionada: {photo.name}</p> : null}

              <div aria-live="polite">
                {photoError ? (
                  <p className="notice notice--error">
                    <span className="notice__label">Não deu.</span> {photoError}
                  </p>
                ) : null}
                {savePhoto.isError ? (
                  <p className="notice notice--error">
                    <span className="notice__label">Não deu para enviar a foto.</span>{" "}
                    {savePhoto.error.message} Tente de novo.
                  </p>
                ) : null}
                {savePhoto.isSuccess && !photo ? (
                  <p className="notice notice--ok">
                    <span className="notice__label">Foto atualizada.</span> Ela já aparece no seu
                    perfil.
                  </p>
                ) : null}
              </div>

              <button
                className="button"
                type="button"
                onClick={() => photo && savePhoto.mutate(photo)}
                disabled={!photo || savePhoto.isPending}
              >
                {savePhoto.isPending ? "Enviando…" : "Enviar foto"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Sua estante</h2>
          <p className="muted field-help">
            Quatro livros, na ordem que você quiser. Eles aparecem no seu perfil.
          </p>
          <FavoritesShelf books={me.favorites} editable canEdit />
        </div>
      </section>
    </>
  );
}
