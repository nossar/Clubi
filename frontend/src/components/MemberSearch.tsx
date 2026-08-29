import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import type { UserBrief } from "../api/types";
import { useDebouncedValue } from "../useDebouncedValue";
import { MemberAvatar } from "./MemberAvatar";

/** The one screen that reads `?q=`. Exported so nobody retypes the path in a `navigate()`. */
export const SEARCH_PATH = "/search";

/** How many suggestions the header shows. Five fit under the field without a scrollbar. */
const SUGGESTION_LIMIT = 5;

/**
 * What actually goes to the API.
 *
 * A member reads their own handle as `@ana` — it is printed with the `@` on every profile — but
 * `search_users` matches `username__icontains` against the stored value, which has none. Without
 * this, typing the handle the way the site displays it finds nobody.
 */
export function searchTerm(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

/**
 * `GET /api/users?q=&limit=`, shared by the header's suggestions and the `/search` screen.
 *
 * `limit` is part of the key because it is part of the request: the header asks for five and the
 * screen for fifty, and a single key for both would hand the screen the header's five. Nothing
 * invalidates it — searching is a read, and `staleTime` alone makes retyping a term cheap.
 *
 * The caller passes an already-debounced term, rather than this hook debouncing internally, so
 * that the screen can still tell "" (list the club) from "still typing".
 */
export function useMemberSearch(term: string, limit: number, enabled = true) {
  return useQuery({
    queryKey: ["users", "search", term, limit],
    queryFn: () => api<UserBrief[]>(`/users?q=${encodeURIComponent(term)}&limit=${limit}`),
    enabled,
  });
}

/**
 * The site's search field, mounted once in the `Header` so it is reachable from every screen.
 *
 * **There is no magnifier**, here or anywhere: where an icon would be a control, the brand uses a
 * word, and DESIGN.md 6.3 names this exact case — "campo com placeholder *Buscar membros*"
 * (E-07). The submit control is the Enter key and the panel's "Ver todos os resultados".
 *
 * **One field, not two.** On `/search` this input is bound straight to `?q=`, so the screen has
 * no second copy of the same box: state rule 1 wants the term in the URL, and a screen-level
 * `useState` mirroring the header would be exactly the duplicate that breaks F5 and shared
 * links. Off that screen the field is a draft with no screen behind it yet, which becomes URL
 * state the moment it is submitted — and there the suggestions panel does the work the results
 * list does on `/search`, which is why the panel is suppressed once you are already there.
 */
export function MemberSearch() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSearchScreen = location.pathname === SEARCH_PATH;
  const value = onSearchScreen ? (searchParams.get("q") ?? "") : draft;

  function setValue(next: string) {
    if (!onSearchScreen) {
      setDraft(next);
      return;
    }
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("q", next);
    } else {
      params.delete("q");
    }
    // replace: typing must not push one history entry per keystroke, or "Voltar" would walk back
    // through "a", "an", "ana" instead of leaving the screen.
    setSearchParams(params, { replace: true });
  }

  const term = searchTerm(value);
  const debouncedTerm = useDebouncedValue(term);
  const suggesting = !onSearchScreen && open && debouncedTerm.length > 0;
  const { data: suggestions } = useMemberSearch(debouncedTerm, SUGGESTION_LIMIT, suggesting);

  function submit(event: FormEvent) {
    event.preventDefault();
    setOpen(false);
    // On /search the URL already carries the term — Enter has nowhere left to go.
    if (onSearchScreen) return;
    setDraft("");
    navigate(term ? `${SEARCH_PATH}?q=${encodeURIComponent(term)}` : SEARCH_PATH);
  }

  function leaveSuggestions() {
    setOpen(false);
    setDraft("");
  }

  /**
   * The panel is a list of links, so Tab already walks it; the arrows are the shortcut a member
   * expects from a suggestion list, and Escape closes it from anywhere inside. Full combobox
   * ARIA — `aria-activedescendant` over a virtual cursor — would be a heavier pattern than the
   * one `BookPicker` already set for the same job.
   *
   * The handler sits on the wrapper rather than on the input because focus moves *into* the
   * panel: with it on the input, Escape stopped working the moment ArrowDown had been used.
   */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const stops: HTMLElement[] = [
      ...(inputRef.current ? [inputRef.current as HTMLElement] : []),
      ...Array.from(panelRef.current?.querySelectorAll("a") ?? []),
    ];
    const here = stops.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? here + 1 : here - 1;
    if (here === -1 || next < 0 || next >= stops.length) return;

    event.preventDefault();
    stops[next].focus();
  }

  return (
    <div
      className="member-search"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Focus leaving the whole component closes the panel; focus moving from the field into
        // one of the suggestions is not "leaving", which is what relatedTarget tells us.
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <form role="search" onSubmit={submit}>
        <input
          ref={inputRef}
          className="field-text"
          type="search"
          name="q"
          value={value}
          aria-label="Buscar membros"
          placeholder="Buscar membros"
          autoComplete="off"
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          // Click, not focus: Escape closes the panel and hands focus back to the field, and
          // an onFocus here would reopen what the member just dismissed. Tabbing through the
          // header should not pop a panel either — typing (onChange) always opens it.
          onClick={() => setOpen(true)}
        />
      </form>

      {suggesting && suggestions ? (
        <ul className="member-search__panel" aria-label="Sugestões de membros" ref={panelRef}>
          {suggestions.map((person) => (
            <li key={person.username}>
              <Link
                className="member-search__hit"
                to={`/u/${person.username}`}
                onClick={leaveSuggestions}
              >
                <MemberAvatar person={person} />
                <span className="member-search__names">
                  <span>{person.full_name || person.username}</span>
                  <span className="muted member-search__username">@{person.username}</span>
                </span>
              </Link>
            </li>
          ))}

          {suggestions.length === 0 ? (
            <li className="muted member-search__note">Ninguém com esse nome.</li>
          ) : (
            <li>
              <Link
                className="member-search__note member-search__all"
                to={`${SEARCH_PATH}?q=${encodeURIComponent(debouncedTerm)}`}
                onClick={leaveSuggestions}
              >
                Ver todos os resultados
              </Link>
            </li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
