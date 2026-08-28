/* The brand's graphic elements. There is no icon library and there will not be one (DESIGN.md
 * 6.3, decided in E-07): where an icon means something it is a brand element, and where it is a
 * control it is a word. Do not add Lucide, Feather or Heroicons here.
 *
 * The files are inlined rather than linked so their `fill="currentColor"` actually inherits the
 * surrounding colour — that is what lets one drawing serve cream-on-wine and wine-on-cream
 * without a second "sticker" file (DESIGN.md 6.1). They already carry aria-hidden. */

import livroAberto from "../assets/elements/livro-aberto.svg?raw";
import nuvem from "../assets/elements/nuvem.svg?raw";

// Only what Fase 4 renders. Add an entry when a screen actually needs it, and keep to at most
// two elements per screen (DESIGN.md 6.2) — they are punctuation, not content.
const ELEMENTS = {
  "livro-aberto": livroAberto,
  nuvem,
} as const;

export type BrandElementName = keyof typeof ELEMENTS;

export function BrandElement({ name }: { name: BrandElementName }) {
  return (
    <span
      className="brand-element"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ELEMENTS[name] }}
    />
  );
}
