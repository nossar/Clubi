import { useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Link } from "react-router-dom";

import { csrfToken } from "../api/client";
import { useCurrentUser } from "../context/CurrentUser";
import { BrandElement } from "./BrandElement";
import { MemberAvatar } from "./MemberAvatar";

/**
 * The account corner of the header: the greeting, your photo, and behind them "Meu perfil" and
 * "Sair".
 *
 * It replaced two siblings that only looked unrelated — a "Olá, Ana" link into `/u/ana` and a
 * logout form parked beside it — which is what put a destructive control one stray click from
 * the greeting. Folding both under the greeting is what the header already does everywhere else:
 * one thing per line, and the second level asked for.
 *
 * Three things decide the shape:
 *
 * 1. **A disclosure, not an ARIA menu.** Same choice `MemberSearch` and `FinishedReaders` made:
 *    `aria-expanded` + `aria-controls` over a panel that is in the DOM at all times (so the
 *    reference never dangles), rather than `role="menu"` with a virtual cursor. Two items do not
 *    earn the heavier pattern, and Tab already walks a link and a button.
 * 2. **The word stays, the glyph is added to it.** DESIGN.md 6.3 rule 2 wants a word where an
 *    icon would be a control, and the trigger's accessible name is the greeting — the photo and
 *    the arrow are both `aria-hidden`. The arrow is the same `seta-baixo`/`seta-cima` pair the
 *    shelf reorders with (rule 3), swapped rather than CSS-rotated: these are hand-drawn strokes
 *    with open ends, and a flipped `seta-baixo` reads as a mirror of itself.
 * 3. **Logout is still a rendered POST.** It belongs to `django.contrib.auth` (ADR-05) and
 *    `LogoutView` refuses GET, so what moved into the panel is the same form, token and all.
 */
export function AccountMenu() {
  const user = useCurrentUser();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const firstName = user.full_name.trim().split(" ")[0] || user.username;

  /**
   * Escape closes from anywhere inside and hands focus back to the trigger; the arrows are the
   * shortcut a member expects once a panel has opened under a control. The handler sits on the
   * wrapper, not on the trigger, because focus moves *into* the panel — on the trigger, Escape
   * would stop working the moment ArrowDown had been used (the bug `MemberSearch` already hit).
   */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const stops: HTMLElement[] = [
      ...(triggerRef.current ? [triggerRef.current as HTMLElement] : []),
      ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a, button") ?? []),
    ];
    const here = stops.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? here + 1 : here - 1;
    if (here === -1 || next < 0 || next >= stops.length) return;

    event.preventDefault();
    // ArrowDown on a closed menu is the member asking for it, exactly like clicking the trigger.
    setOpen(true);
    stops[next].focus();
  }

  return (
    <div
      className="account-menu"
      onKeyDown={onKeyDown}
      onBlur={(event) => {
        // Focus leaving the whole component closes it; focus moving from the trigger into one of
        // the two items is not "leaving", which is what relatedTarget tells us.
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        className="account-menu__trigger"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className="account-menu__greeting">
          <span className="account-menu__hello">Olá, </span>
          {firstName}
        </span>
        <MemberAvatar person={user} />
        <span className="account-menu__arrow">
          <BrandElement name={open ? "seta-cima" : "seta-baixo"} />
        </span>
      </button>

      <div className="account-menu__panel" id={panelId} hidden={!open} ref={panelRef}>
        <Link
          className="account-menu__item"
          to={`/u/${user.username}`}
          onClick={() => setOpen(false)}
        >
          Meu perfil
        </Link>

        <form method="post" action="/accounts/logout/">
          <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken()} />
          <button className="account-menu__item" type="submit">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
