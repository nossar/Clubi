/* The brand's graphic elements. There is no icon library and there will not be one (DESIGN.md
 * 6.3, decided in E-07): where an icon means something it is a brand element, and where it is a
 * control it is a word. Do not add Lucide, Feather or Heroicons here.
 *
 * The files are inlined rather than linked so their `fill="currentColor"` actually inherits the
 * surrounding colour — that is what lets one drawing serve cream-on-wine and wine-on-cream
 * without a second "sticker" file (DESIGN.md 6.1). They already carry aria-hidden. */

import balao from "../assets/elements/balao.svg?raw";
import clips from "../assets/elements/clips.svg?raw";
import estrela5 from "../assets/elements/estrela-5.svg?raw";
import livroAberto from "../assets/elements/livro-aberto.svg?raw";
import livroFechado from "../assets/elements/livro-fechado.svg?raw";
import nuvem from "../assets/elements/nuvem.svg?raw";
import setaBaixo from "../assets/elements/seta-baixo.svg?raw";
import setaCima from "../assets/elements/seta-cima.svg?raw";
import x from "../assets/elements/x.svg?raw";

// Add an entry when a screen actually needs it, and keep to at most two elements per screen
// (DESIGN.md 6.2) — they are punctuation, not content. "x", "seta-cima" and "seta-baixo" are the
// glyphs that are not from the brandbook: DESIGN.md 6.3 rule 3 keeps a short residue of interface
// glyphs *drawn in the marca's stroke* — irregular line, open ends, the elements' weight — and
// versioned here beside the ten brandbook drawings, precisely so that no icon library is needed
// (E-07). They are the whole residue; a fourth one is a decision, not a file.
const ELEMENTS = {
  balao,
  clips,
  // The rating star is the brand's own five-pointed star (DESIGN.md 6.3): because the SVG paints
  // with currentColor, "not rated" is the same drawing in --clubi-line — no filled/hollow pair.
  "estrela-5": estrela5,
  "livro-aberto": livroAberto,
  // The closed book is what DESIGN.md 6.3 assigns to a history of choices: PickHistory.
  "livro-fechado": livroFechado,
  nuvem,
  // The three residual interface glyphs (DESIGN.md 6.3 rule 3), drawn to match: same 100×100
  // viewBox, same 9-unit round stroke, same hand tremor as the brandbook elements.
  "seta-baixo": setaBaixo,
  "seta-cima": setaCima,
  x,
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
