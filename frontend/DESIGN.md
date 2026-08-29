# Clubi — Fonte da verdade visual

Este documento destila a identidade visual do clubi (pasta `frontend/clubi/`) em decisões
aplicáveis a um site. **Ele é pré-requisito de qualquer trabalho de frontend**: nenhuma cor, fonte,
espaçamento, raio, sombra ou escolha de tom deve entrar no código sem estar aqui — e cada item aqui
ou é literal do brandbook, ou está registrado na seção [12. Extrapolações](#12-extrapolações).

Se você precisa de um valor que não existe neste documento, o caminho é **adicioná-lo aqui com sua
justificativa**, não decidi-lo no CSS. Um token que nasce direto no componente é exatamente a
escolha arbitrária que este documento existe para impedir.

| | |
|---|---|
| **Status** | Fechado para a Fase 4. **As 12 primeiras extrapolações foram revisadas pelo fundador em 2026-08-27.** A **E-13** (dimensões de componente, seção 8.7) nasceu durante a Fase 4, ganhou três linhas na Fase 5 (área de texto, botão de remover imagem, proporção de imagem de post), mais quatro na Fase 6 (foto de perfil, estrela de nota, slot da estante, capa do histórico), mais duas na Fase 7 (campo de busca do cabeçalho, cartão de membro), mais duas quando a nota passou a aceitar meia estrela (recorte da metade, prévia) e mais uma na Fase 8 (capa no resultado do catálogo externo), e é a única em aberto. |
| **Fonte primária** | `frontend/clubi/clubi  canva_brandbook.pdf` (6 páginas) |
| **Autoridade** | Em conflito, vence o brandbook. Depois dele, as peças de redes sociais. Depois, este documento. |
| **Idioma** | Documento em pt-BR (convenção do projeto); nomes de token em inglês. |

---

## 1. O que foi analisado

Inventário completo da pasta `frontend/clubi/`, com o que cada parte contribuiu:

| Caminho | Conteúdo | O que saiu daqui |
|---|---|---|
| `clubi  canva_brandbook.pdf` | 6 páginas: capa clara, capa escura, paleta, tipografia, elementos, moodboard | Paleta com hex, famílias e métricas tipográficas, inventário de elementos, referência fotográfica |
| `logo/` | 3 variantes PNG (vinho, clara, amarela) + QR | Regras de aplicação, proporção, área de respiro |
| `tipografia/` | Clash Display (6 pesos, `.otf`) e Manrope (7 pesos, `.ttf`) + licença | Arquivos para self-host, pesos a embarcar |
| `elementos/` | 10 ilustrações planas + 8 versões *sticker* | Vocabulário de ícones decorativos e regra plano vs. sticker |
| `posts/`, `redes sociais/` | 9 peças aplicadas | Linguagem de composição, uso de textura, **tom de voz** |
| `documentos/` | Planilhas de gestão | Nada de visual — não é fonte de design |
| `arquivos abertos/` | O `.ai` editável (14 pranchetas, PDF por dentro) | Os vetores do logo e dos elementos (5.5, 5.6). **Paleta e tipografia de lá estão superadas** — ver o aviso em 5.6 |

Os assets derivados desse material são os que o código consome, e estão repartidos por quem os usa
(ver 2.1). A pasta `clubi/` é o arquivo-mestre: entrada, nunca dependência de build.

> A pasta `paleta/` mencionada no briefing não existe. A paleta está na **página 3 do brandbook**,
> e é de lá que vêm os hex desta documentação.

---

## 2. Conflito resolvido: a paleta que está no código hoje

`backend/core/static/css/auth.css` está no ar com uma paleta que **não vem do brandbook**:

| Token atual | Valor atual | Origem | Substituto |
|---|---|---|---|
| `--clubi-bg` | `#f6f2ea` | improvisado | `#fdfae7` (brandbook) |
| `--clubi-accent` | `#7a2e2e` | improvisado | `#88013e` (brandbook) |
| `--clubi-ink` | `#1d1a17` | improvisado | `#26161d` (derivado do vinho) |
| `--clubi-font-sans` | `Inter` | improvisado | `Manrope` (brandbook) |
| `--clubi-font-serif` | `Iowan Old Style` | improvisado | `Clash Display` (brandbook) — **não é serifada** |

Isso contradiz frontalmente a premissa do **ADR-16b** ("a paleta já existe e não está em disputa").
A premissa era falsa: existia uma paleta *no código*, não uma paleta *da marca*. O brandbook é
anterior e é a identidade real do clube.

**Decisão:** o brandbook vence; `auth.css` se realinha. Ver **ADR-17** em
`clubi-decisoes-de-arquitetura.md`, que registra a decisão e a nota de revisão em 16b.

**Consequência operacional:** `styles/tokens.css` e `auth.css` carregam os mesmos valores (é a
mitigação da costura do ADR-05). Mudar um token significa mudar os dois arquivos, sempre — e este
documento primeiro.

**Feito em 2026-08-27.** O `auth.css` já está realinhado: paleta da marca, Manrope e Clash Display
self-hosted, logotipo como SVG mascarado em vez de palavra digitada, e o nome do clube em minúsculo
em todos os templates. Duas correções entraram junto, e nenhuma era de cor: a lista de regras de
senha não recebia estilo nenhum, porque o parser do HTML tira o `<ul>` de dentro do
`<span class="helptext">` e o seletor descendente nunca casava; e o `login.html` mostrava a mesma
mensagem de erro duas vezes, uma do template e outra do `as_p`.

### 2.1 Onde os assets compartilhados moram

As páginas renderizadas de `/accounts/` e a SPA usam **as mesmas fontes e o mesmo logotipo**. Duas
cópias divergiriam, que é exatamente o risco que o ADR-05 manda evitar. Então há uma cópia só,
servida pelo Django:

| Onde | O quê | URL |
|---|---|---|
| `backend/core/static/brand/fonts/` | as 4 fontes em `woff2` | `/static/brand/fonts/…` |
| `backend/core/static/brand/logo-clubi.svg` | o logotipo | `/static/brand/logo-clubi.svg` |
| `frontend/src/assets/elements/` | os 10 elementos | empacotados pelo Vite |

Os elementos ficam no frontend porque só a SPA os usa. Fontes e logotipo ficam no backend porque os
dois lados precisam deles, e em produção é o Django (com WhiteNoise, que já versiona por hash) que
serve tudo.

> ⚠️ **O `vite.config.ts` precisa incluir `/static` na lista de proxy**, junto de `/api`, `/admin`,
> `/accounts` e `/media`. Sem isso, a SPA em `:5173` fica sem fonte e sem logo em desenvolvimento —
> e o sintoma é tipografia de sistema, não erro.

---

## 3. Cores

### 3.1 Paleta da marca — literal do brandbook (página 3)

Estes quatro valores são a marca. Não se negociam, não se "ajustam para a web".

| Papel no brandbook | Nome | Hex | Observação |
|---|---|---|---|
| Principal | **vinho** | `#88013e` | A cor do clubi. Texto sobre creme, fundo de seção, logo. |
| Principal | **creme** | `#fdfae7` | Fundo padrão do site. Texto sobre vinho. |
| Secundária | **amarelo** | `#ffd071` | Destaque **apenas sobre vinho**. Ver 3.2. |
| Secundária | **laranja** | `#ed6630` | Destaque, chamada de ação, marca-texto. Ver 3.2. |

> **Discrepância registrada.** Os PNGs de `logo/` e `elementos/` usam `#88003e`; a página de paleta
> especifica `#88013e`. A diferença é de 1/255 num canal e é invisível. **O canônico é `#88013e`**
> (o brandbook é a especificação; os assets são exportação). Não "corrija" os PNGs.

### 3.2 Contraste medido — a restrição que mais molda o layout

Razões WCAG 2.1 calculadas sobre os hex canônicos. Isto não é opinião, é medição:

| Frente | Fundo | Razão | Texto normal | Texto grande (≥24px ou ≥18.66px bold) |
|---|---|---|---|---|
| vinho | creme | **9.43** | AAA | AAA |
| creme | vinho | **9.43** | AAA | AAA |
| amarelo | vinho | **6.84** | AA | AAA |
| vinho | amarelo | **6.84** | AA | AAA |
| laranja | vinho | 3.09 | ✗ falha | AA |
| laranja | creme | 3.06 | ✗ falha | AA |
| **amarelo** | **creme** | **1.38** | ✗ falha | ✗ falha |

Três regras saem daí, e são obrigatórias:

1. **`vinho ⇄ creme` é o par de trabalho.** Todo texto de leitura do site é esse par, num sentido
   ou no outro. É o único par que passa AAA.
2. **Laranja nunca é texto corrido.** Serve para títulos grandes, botões (com fundo laranja e texto
   escuro), marca-texto e traços decorativos. As peças de redes sociais *usam* laranja em
   ênfase dentro de parágrafo — funciona em post a 2160px, **falha na web a 16px**. Não transporte
   esse uso.
3. **Amarelo sobre creme é proibido.** 1.38 é invisível. Amarelo só vive sobre vinho, ou como
   preenchimento de área grande com texto vinho por cima.

### 3.3 Tokens semânticos

Cada linha declara sua procedência. `literal` = está no brandbook. `derivado` = calculado a partir
de cores do brandbook por uma fórmula reproduzível (a fórmula está na coluna). `extrapolado` = não
tem respaldo direto; ver seção 12.

Todas as misturas são interpolação linear em sRGB: `mix(a, b, t)` = `a + (b − a)·t`.

#### Superfícies

| Token | Valor | Procedência | Uso |
|---|---|---|---|
| `--clubi-bg` | `#fdfae7` | literal (creme) | Fundo do documento |
| `--clubi-bg-invert` | `#88013e` | literal (vinho) | Seções de respiro, rodapé, faixas |
| `--clubi-surface` | `#fefdf4` | derivado `mix(creme, #fff, .55)` | Cartão sobre o fundo creme |
| `--clubi-surface-sunken` | `#f7eedf` | derivado `mix(creme, vinho, .05)` | Campo de formulário, área recuada |
| `--clubi-line` | `#edd7cf` | derivado `mix(creme, vinho, .14)` | Régua de 1px, borda de cartão |
| `--clubi-line-strong` | `#e1bebe` | derivado `mix(creme, vinho, .24)` | Borda de input, divisor com peso |
| `--clubi-line-invert` | `#9d2e5c` | derivado `mix(vinho, creme, .18)` | Divisor sobre fundo vinho (1.40 — fio sutil, como deve ser) |

#### Texto

| Token | Valor | Contraste no creme | Procedência | Uso |
|---|---|---|---|---|
| `--clubi-ink` | `#26161d` | 16.47 | derivado `mix(mix(vinho, #000, .70), #242424, .60)` | **Texto corrido.** Ver E-01 |
| `--clubi-ink-brand` | `#88013e` | 9.43 | literal | Títulos, links, tudo que precisa soar "clubi" |
| `--clubi-ink-muted` | `#716664` | 5.28 | derivado `mix(ink, creme, .35)` | Metadado, legenda, `helptext` |
| `--clubi-ink-on-invert` | `#fdfae7` | 9.43 (no vinho) | literal (creme) | Texto sobre vinho |
| `--clubi-ink-muted-on-invert` | `#dcb4b8` | 5.31 (no vinho) | derivado `mix(creme, vinho, .28)` | Metadado sobre vinho |

#### Ação

| Token | Valor | Procedência | Uso |
|---|---|---|---|
| `--clubi-action` | `#88013e` | literal | Botão primário (fundo), link |
| `--clubi-action-hover` | `#780137` | derivado `mix(vinho, #000, .12)` | E-02 |
| `--clubi-action-active` | `#6a0130` | derivado `mix(vinho, #000, .22)` | E-02 |
| `--clubi-action-ink` | `#fdfae7` | literal | Texto sobre botão primário (9.43) |
| `--clubi-accent` | `#ed6630` | literal | Botão de destaque, marca-texto, seta |
| `--clubi-accent-hover` | `#d15a2a` | derivado `mix(laranja, #000, .12)` | E-02 |
| `--clubi-accent-ink` | `#290013` | derivado `mix(vinho, #000, .70)` | Texto sobre laranja: 5.93 no repouso, 4.72 no hover — **AA nos dois** |

> `--clubi-accent-ink` é mais escuro que `--clubi-ink` de propósito, e não é engano: o `--clubi-ink`
> sobre o laranja em hover dá 4.29 e reprovaria em AA. O botão laranja é o único lugar que usa esta
> tinta mais pesada.
| `--clubi-highlight` | `#ffd071` | literal | Preenchimento de destaque **sobre vinho** |
| `--clubi-highlight-ink` | `#88013e` | literal | Texto sobre amarelo (6.84) |
| `--clubi-focus` | `#ed6630` | literal | Anel de foco (3.06 sobre creme — passa o mínimo 3:1 de UI) |

#### Tintas de fundo (chips, avisos, badges sobre creme)

| Token | Valor | Procedência | Texto vinho por cima |
|---|---|---|---|
| `--clubi-tint-wine` | `#f1e1d6` | derivado `mix(creme, vinho, .10)` | 7.77 |
| `--clubi-tint-orange` | `#fadfc6` | derivado `mix(creme, laranja, .18)` | 7.75 |
| `--clubi-tint-yellow` | `#fee7b2` | derivado `mix(creme, amarelo, .45)` | 8.15 |

#### Estado — **integralmente extrapolado** (ver E-03)

O brandbook não tem cor de erro, sucesso ou aviso. A paleta é quente do começo ao fim e o vinho já
ocupa a faixa vermelha, então "erro = vermelho" colidiria com a cor da marca.

| Token | Valor | Contraste no creme | Uso |
|---|---|---|---|
| `--clubi-danger` | `#b83620` | 5.58 | Erro de validação, ação destrutiva |
| `--clubi-danger-ink` | `#ffffff` | 5.86 sobre danger | Texto sobre danger |
| `--clubi-success` | `#2f6b4f` | 6.00 | Confirmação ("progresso salvo") |
| `--clubi-warning` | `#8e3d1d` | 7.06 | Aviso; é `mix(laranja, #000, .40)`, o laranja legível |

> ⚠️ **`--clubi-danger` (`#b83620`) contra `--clubi-ink-brand` (`#88013e`) tem só 1.69 de razão.**
> São matizes diferentes mas luminosidades parecidas. **Nunca sinalize erro só com cor** — sempre
> ícone + texto. Vale para `errorlist`, borda de input inválido e toast.

### 3.4 Ritmo de cor: alternância

As peças de carrossel alternam fundo creme e fundo vinho, nunca dois iguais em sequência
(`redes sociais/posts/post 2/`: creme → vinho → creme → vinho → creme). É o recurso que dá ritmo
sem introduzir cor nova.

Na web, isso vira **seções de página inteira alternando `--clubi-bg` e `--clubi-bg-invert`** — a
Home é o lugar óbvio (destaque do mês em vinho, feed em creme). Não use a alternância dentro de uma
lista de cartões: o efeito de zebra pertence à página, não ao item.

---

## 4. Tipografia

### 4.1 Famílias — literal do brandbook (página 4)

| Família | Papel declarado no brandbook | Pesos a embarcar |
|---|---|---|
| **Clash Display** | "títulos e destaques" | Regular (400), Semibold (600) |
| **Manrope** | "textos e informações" | Regular (400), Bold (700) |

O brandbook nomeia **exatamente esses pesos**. A pasta traz 6 pesos de Clash e 7 de Manrope —
embarque só os quatro citados. Cada peso extra é download que o membro paga sem contrapartida de
marca.

**Clash Display não é uma serifada.** É uma grotesca de display, geométrica e de contraste baixo.
O `--clubi-font-serif` que existe hoje no `auth.css` está errado no nome e no valor.

### 4.2 Licença e entrega

| | |
|---|---|
| Clash Display | `tipografia/clash-display-font/Befonts-License.txt` — *Commercial Use Allowed*. Self-host permitido. |
| Manrope | SIL Open Font License. Self-host permitido. |

**Self-host as duas, a partir do repositório.** Não use CDN do Google Fonts: o ADR-04 estabelece
origem única, e uma terceira origem no caminho crítico de renderização contradiz isso sem ganho.

**Feito.** Os quatro pesos estão convertidos para `woff2` em `backend/core/static/brand/fonts/`,
servidos pelo Django em `/static/brand/fonts/` — ver 2.1 para o porquê de morarem no backend:

| Arquivo | Origem | Peso |
|---|---|---|
| `ClashDisplay-Regular.woff2` | 26,3 KB → **16,1 KB** | 400 |
| `ClashDisplay-Semibold.woff2` | 26,5 KB → **16,3 KB** | 600 |
| `Manrope-Regular.woff2` | 94,6 KB → **30,2 KB** | 400 |
| `Manrope-Bold.woff2` | 94,5 KB → **30,5 KB** | 700 |
| | 241,9 KB → **93,1 KB** | |

> ⚠️ **Armadilha no nome interno.** A Clash Semibold se declara como família
> `"Clash Display Semibold"`, e não como `"Clash Display"` peso 600. Se você só apontar o arquivo e
> confiar no nome de dentro, o navegador trata as duas como famílias diferentes e o `font-weight`
> para de funcionar. O `@font-face` abaixo renomeia as duas para a mesma família, que é o que
> corrige isso. A Manrope não tem esse problema.

```css
@font-face {
  font-family: "Clash Display";
  src: url("/static/brand/fonts/ClashDisplay-Regular.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Clash Display";   /* renomeada: o arquivo se chama "Clash Display Semibold" */
  src: url("/static/brand/fonts/ClashDisplay-Semibold.woff2") format("woff2");
  font-weight: 600; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Manrope";
  src: url("/static/brand/fonts/Manrope-Regular.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: "Manrope";
  src: url("/static/brand/fonts/Manrope-Bold.woff2") format("woff2");
  font-weight: 700; font-style: normal; font-display: swap;
}
```

Pré-carregue apenas Clash Semibold e Manrope Regular, que são os dois que aparecem acima da dobra.
**Não sintetize peso**: não existe Clash 700 nem Manrope 600 no projeto; pedir um peso que não foi
embarcado faz o navegador engordar o traço artificialmente e descaracteriza a marca.

### 4.3 Métricas — literal do brandbook

| Família | Entre letras | Entre linha |
|---|---|---|
| Clash Display | `0` | `1.0` |
| Manrope | `-20` | `1.1` |

O `-20` é unidade Canva (milésimos de em) → **`letter-spacing: -0.02em`**.

**`line-height: 1.1` em parágrafo web é ilegível.** Os valores do brandbook são para peça gráfica,
onde todo texto é curto. Ver extrapolação **E-04**: a entrelinha do brandbook é preservada em
títulos e texto curto, e aberta em texto corrido.

### 4.4 Escala

Base 16px. Passos de razão ~1.25 arredondados para pixel inteiro (E-05).

| Token | rem | px | Fonte | Entrelinha | Uso |
|---|---|---|---|---|---|
| `--text-xs` | 0.75 | 12 | Manrope | 1.4 | Selo, contador, `helptext` |
| `--text-sm` | 0.875 | 14 | Manrope | 1.5 | Metadado, legenda, label |
| `--text-base` | 1 | 16 | Manrope | **1.6** | **Texto corrido** — resenha, post, bio |
| `--text-md` | 1.25 | 20 | Manrope | 1.5 | Texto de destaque, chamada |
| `--text-lg` | 1.5 | 24 | Clash | 1.2 | Título de cartão, `h4`/`h3` |
| `--text-xl` | 2 | 32 | Clash | 1.1 | `h2` — título de seção |
| `--text-2xl` | 2.5 | 40 | Clash | 1.1 | `h1` de página interna |
| `--text-3xl` | 3 | 48 | Clash | **1.0** | `h1` da Home |
| `--text-4xl` | 4 | 64 | Clash | **1.0** | Número grande, destaque do mês |

`1.0` e `1.1` são o valor literal do brandbook, aplicados onde ele os aplicava: display.

### 4.5 Papéis

- **Clash Display Semibold** — `h1`–`h3`, número de destaque, rótulo de botão grande.
- **Clash Display Regular** — `h4`, subtítulo longo, citação (`User.quote`).
- **Manrope Regular** — todo texto corrido, input, label, tabela.
- **Manrope Bold** — ênfase dentro de parágrafo, label de formulário, valor numérico em linha.

**Nunca use Clash em texto corrido** (entrelinha 1.0 e formas de display cansam em bloco) e
**nunca use Manrope em `h1`** — isso inverteria a hierarquia declarada no brandbook.

### 4.6 O nome da marca

Em toda peça analisada o nome aparece **`clubi`, minúsculo** — inclusive no meio de frase
("acesse o link da bio", "os próximos capítulos do clubi"). Trate como nome próprio estilizado:

- Em texto de interface: `clubi`, minúsculo, sempre. Nunca `Clubi`, nunca `CLUBI`.
- No `<title>`, em `aria-label` e em e-mail transacional: idem.
- Exceção única: início de frase em texto formal do Admin, onde a minúscula lê como erro.
- **O logotipo é lettering desenhado à mão, não é Clash Display.** Nunca "escreva" o nome com fonte
  para simular o logo — use o arquivo de `logo/`.

---

## 5. Logo

### 5.1 Variantes disponíveis

Todos os PNGs têm canvas 1080×901 e mancha de tinta 648×303 (**proporção 2.139:1**).

| Arquivo | Cor da tinta | Fundos permitidos |
|---|---|---|
| `logo/logo-transp-clubi.png` | vinho `#88003e` | creme, branco, `--clubi-surface`, tinta clara, foto clara com contraste conferido |
| `logo/logo-transp-clara-clubi.png` | creme `#fdfae7` | vinho, laranja, foto escura, sobreposição escura |
| `logo/logo-transpi-clubi-amarela.png` | amarelo `#ffd071` | **vinho apenas** (6.84) |
| `logo/qr-clubi-red.png` | vinho, 927×927 | QR de captação. Não é logo — não use como marca. |

### 5.2 Fundos proibidos

- **Amarela sobre creme** — 1.38. Proibido.
- **Amarela sobre laranja, ou clara sobre amarelo** — sem contraste utilizável.
- **Vinho sobre laranja** (3.09) — só em tamanho grande e nunca como marca de cabeçalho.
- **Qualquer variante sobre foto sem véu.** As peças resolvem isso com cartão ou faixa sólida atrás.
  Reproduza isso: caixa sólida ou sobreposição, nunca o logo solto na foto.
- **Sobre a textura xadrez** sem bloco sólido por baixo — a textura come o traço texturizado.

### 5.3 Área de respiro e tamanho

Os PNGs **já vêm com respiro**: 216px laterais (= 1/3 da largura da mancha) e 299px acima/abaixo.
Usando o arquivo como está, o respiro está garantido.

Se recortar até a mancha, aplique **no mínimo 1/3 da largura do logotipo de respiro em todos os
lados** (E-06), livre de texto, borda e foto.

**Tamanho mínimo na web: 96px de largura** (E-06). O lettering tem falhas de textura propositais que
viram sujeira abaixo disso. No cabeçalho, 120–140px é o alvo.

### 5.4 Proibições de manipulação

Não recolorir fora das três variantes · não distorcer (preserve 2.139:1) · não rotacionar (o traço
já é irregular por desenho; girar lê como defeito) · não contornar, não sombrear, não aplicar
gradiente · não encaixar em forma geométrica como "ícone" · não reconstruir com fonte.

### 5.5 SVG: resolvido

`logo/` só tinha PNG — nítido só no tamanho exportado e com a cor congelada no arquivo. Os vetores
foram extraídos do `arquivos abertos/clubi id visual.ai` (que é PDF por dentro) e estão em:

```
backend/core/static/brand/logo-clubi.svg    25 paths, 25,8 KB, viewBox 0 0 553.19 258.53
```
Servido em `/static/brand/logo-clubi.svg`. Mora no backend porque as páginas de `/accounts/`
também o usam — ver 2.1.

Proporção 2.140, contra 2.139 medido nos PNGs — é o mesmo logotipo, com toda a textura de pincel
preservada.

**Uma versão só, colorida por CSS.** O SVG usa `fill="currentColor"`, então as três variantes do
brandbook saem do mesmo arquivo:

| Variante | Como |
|---|---|
| vinho | `color: var(--clubi-wine)` |
| clara | `color: var(--clubi-cream)` |
| amarela | `color: var(--clubi-yellow)` |

As regras de fundo permitido de **5.2 continuam valendo integralmente** — poder trocar a cor por CSS
não autoriza combinação nova. Amarelo sobre creme continua proibido, agora com mais facilidade de
errar por descuido.

O SVG traz `role="img"` e `aria-label="clubi"`; usado como `<img>`, mantenha `alt="clubi"`.

### 5.6 Elementos em SVG

Os dez elementos também foram extraídos, em `frontend/src/assets/elements/`, todos com
`currentColor` e `aria-hidden="true"`, somando **97 KB**:

`asterisco` · `balao` · `caixa` · `carta` · `clips` · `estrela-5` · `estrela-8` ·
`livro-aberto` · `livro-fechado` · `nuvem`

Nomeados pelo que são, não pela numeração enganosa dos PNGs (ver 6. e a nota sobre as estrelas).

> **O `.ai` é uma versão anterior da identidade — não é fonte de verdade.** Ele traz outra paleta
> (rosa, verde e azul, além do vinho/laranja/amarelo) e outra dupla tipográfica, declarada na
> prancheta 6: *"Títulos Please Display VF / Textos Real Head Pro"*. Nada disso sobreviveu no
> brandbook, que é posterior e manda (ver o quadro de autoridade no topo). Também há uma
> sub-marca "Gestão 2026" que o brandbook não cobre. **Do `.ai` só se aproveitam os desenhos** —
> logotipo e elementos, que são idênticos nos dois. Se alguém abrir esse arquivo procurando paleta
> ou tipografia, vai encontrar a resposta errada.

---

## 6. Elementos gráficos

Dez ilustrações de traço à mão, todas em vinho chapado (`#88003e`), monocromáticas, sem
preenchimento:

| Arquivo | Motivo | Significado sugerido na interface |
|---|---|---|
| `livro.png` | livro aberto | Leitura em andamento, Livro do Mês |
| `livro 2.png` | livro fechado / pilha | Acervo, histórico de escolhas |
| `balao.png` | balão de fala | Post, comentário, discussão |
| `carta.png` | envelope | Convite, e-mail, notificação |
| `nuvem.png` | nuvem | Encontro, respiro, estado vazio |
| `clips.png` | clipes de papel | Anexo, imagem em post |
| `caixa.png` | caixa aberta | Brinde literário |
| `estrela 1.png` | estrela 8 pontas | Destaque, novidade |
| `estrela 2.png` | asterisco | Nota de rodapé, marcador decorativo |
| `estrela 3.png` | estrela 5 pontas | Avaliação, favorito |

> Os nomes dos PNGs enganam: `estrela 1` é a de **oito** pontas e `estrela 3` é a de **cinco**.
> Por isso os SVGs (5.6) foram renomeados para `estrela-8.svg` e `estrela-5.svg` — use-os pelo
> nome descritivo e não confie na numeração dos PNGs.

### 6.1 Plano vs. sticker

`elementos/stickers/` traz 8 desses motivos com contorno *offset* creme (`#f8f8e6`), no estilo
adesivo recortado. A escolha não é estética, é de legibilidade de fundo:

- **Sobre creme → versão plana** (`elementos/*.png`). O contorno creme do sticker some.
- **Sobre vinho, laranja ou foto → versão sticker** (`elementos/stickers/*.png`). O contorno é o
  que separa o traço vinho do fundo vinho.

Faltam sticker de `livro 2` e `estrela 1` (a de 8 pontas) — se precisar deles sobre vinho, gere o
sticker a partir do `.ai`, não improvise contorno em CSS.

> **Com os SVGs de 5.6, essa dicotomia deixa de existir na maior parte dos casos.** Os dez
> elementos vetoriais usam `currentColor`: sobre vinho basta `color: var(--clubi-cream)` e o traço
> inverte sozinho, sem precisar de arquivo separado. O sticker (contorno *offset*) continua sendo
> um recurso à parte — use-o quando quiser o efeito de adesivo recortado, não como solução de
> contraste.

### 6.2 Como usar sem virar clipart

As peças usam **um ou dois elementos por composição**, nas margens, nunca no centro, nunca em
grade. São pontuação, não conteúdo.

- No máximo **2 elementos por tela**, fora de fluxo, ancorados em canto ou margem.
- `aria-hidden="true"` em todos — são decoração. Um estado vazio ilustrado ainda precisa de texto.
- Em `elementos/` são PNG de ~200px. Servem como decoração pequena/média; **não amplie** além de
  ~240px (o traço texturizado esgarça).
- Exceção legítima ao "no máximo 2": o padrão de rótulo em círculo desenhado
  (`redes sociais/.../4.png`, "Como funciona"), onde cada item é ícone + rótulo. Aí é conteúdo, não
  decoração — e cada um precisa de texto acessível.
- **Não crie elementos novos.** O conjunto de dez é o vocabulário. Faltando um motivo, ou reusa um
  existente, ou desenha no `.ai` e adiciona à pasta — não puxe de biblioteca de ícones. Um
  Feather/Lucide no meio desse traço destrói a coerência instantaneamente.

### 6.3 Ícones de interface — não existe biblioteca, e não vai existir

**Decidido (E-07): o projeto não adota conjunto de ícones.** Um traço de biblioteca ao lado do
desenho à mão da marca destrói a coerência, e adaptar nuvem em menu-hambúrguer seria pior ainda.
A saída é separar dois problemas que costumam ser tratados como um só.

**1. Onde o ícone carrega significado, use o elemento da marca.** Aqui ele é ganho, não remendo:

| Necessidade | Elemento | Componente |
|---|---|---|
| Nota do livro | `estrela-5` | `StarRating` |
| Anexar imagem | `clips` | `NewPost` |
| Post, comentário | `balao` | `PostCard`, `Feed` |
| Livro do Mês, leitura em curso | `livro-aberto` | `MonthlyPickHighlight` |
| Histórico de escolhas | `livro-fechado` | `PickHistory` |
| Estado vazio | `nuvem` | qualquer lista vazia |
| Convite, notificação | `carta` | onboarding |
| Brinde literário | `caixa` | — |

A estrela da avaliação ser **a estrela da marca** é melhor do que qualquer biblioteca entregaria. E
como os SVGs usam `currentColor`, o estado "não avaliado" é a mesma estrela em `--clubi-line` — sem
segundo arquivo, sem variante preenchida/vazada.

**2. Onde o ícone é controle, use palavra.** A marca já faz isso: todas as peças resolvem com texto
("Quero ler", "save the date", "acesse o link da bio"). Então:

| Em vez de | Use |
|---|---|
| lápis, lixeira, disquete, `+` | **"Editar"**, **"Excluir"**, **"Salvar"**, **"Publicar"** |
| chevron de paginação | **"Ver mais"** — o feed devolve `has_next`, então é um botão só |
| lupa | campo com placeholder **"Buscar membros"** |
| seta de voltar | **"← Voltar"** |

Botão com rótulo é mais acessível que ícone sozinho e conversa com o tom da seção 9. **As Fases 4 a
8 saem inteiras com zero ícone funcional.** A Fase 7 era o teste mais provável dessa regra, porque
é a fase da busca: o campo do cabeçalho ficou com o `placeholder` "Buscar membros" e nenhuma lupa,
exatamente como a linha desta tabela previa. A Fase 8 acrescentou o caso que a tabela não previa —
**espera**: a consulta ao catálogo externo pode levar segundos, e onde caberia um *spinner* está
uma frase ("Procurando “…” no catálogo aberto…"), pelo mesmo motivo que o controle é a palavra
"Procurar no catálogo aberto" e não uma lupa. O `×` que o Chrome desenha dentro de um
`<input type="search">` é do navegador, não nosso — a semântica do campo vale mais que o pixel, e
esta seção governa o que o projeto desenha.

**3. O resíduo: dois glifos.** Sobram `×` (fechar) e o menu do celular, onde palavra fica desajeitada
num canto. Quando forem necessários, **desenhe-os no traço da marca** — linha irregular, ponta
aberta, leve tremor, espessura equivalente à dos elementos — e versione junto em
`src/assets/elements/`. Dois glifos, não uma dependência.

---

## 7. Textura e composição

O que as peças aplicadas fazem, e que a interface deve ecoar sem imitar literalmente:

| Recurso | Onde aparece | Tradução para a web |
|---|---|---|
| **Grão de papel** | Todo fundo creme | Textura sutil no `body`; ver E-08 |
| **Xadrez vinho** | Fundos vinho de capa | Só em faixa/herói. Nunca sob texto corrido |
| **Marca-texto** | Palavra sobre bloco laranja/vinho sólido, cantos retos | Selo e `<mark>`: fundo sólido, `--radius-none`, sem sombra |
| **Recorte com borda branca** | Fotos das peças | Capa de livro e foto de perfil com borda creme grossa + sombra quente |
| **Papel rasgado** | Divisórias | Divisor decorativo; não é obrigatório |
| **Rotação leve** | Selos, cartões (±2°) | Ver E-09: rotação sim, só em decoração |
| **Círculo/rabisco à mão** | Ênfase em palavra | SVG decorativo sobre palavra-chave, `aria-hidden` |
| **Carimbo, selo postal** | `.../post 2/1.png` | Cartão de convite/onboarding |

**A regra que segura tudo:** a colagem vive na **moldura** — herói, estado vazio, rodapé, cartão de
convite. O **miolo funcional** — formulário, feed, barra de progresso, lista de leitores — é limpo,
alinhado e previsível. Colagem em cima de fluxo de dados vira ruído e derruba a legibilidade que a
seção 3.2 conquistou.

---

## 8. Espaçamento, forma e layout

Nada nesta seção está no brandbook (E-10). Tudo é derivado do que se observa nas peças.

### 8.1 Espaçamento — base 4px

| Token | Valor | Uso típico |
|---|---|---|
| `--space-1` … `--space-4` | 4, 8, 12, 16px | Dentro do componente |
| `--space-5`, `--space-6` | 24, 32px | Entre componentes |
| `--space-7`, `--space-8` | 48, 64px | Entre blocos, respiro de seção |
| `--space-9` | 96px | Entre seções de página inteira |

### 8.2 Raio

O brandbook mistura dois vocabulários de forma **de propósito**: quadrado duro nos blocos de
destaque (os swatches da página 3 são quadrados perfeitos; os marca-texto têm canto reto) e pílula
total nos selos ("save the date"). Preserve os dois extremos:

| Token | Valor | Uso |
|---|---|---|
| `--radius-none` | `0` | Marca-texto, bloco de destaque, faixa. **Não arredonde estes.** |
| `--radius-sm` | `4px` | Input, selo pequeno |
| `--radius-md` | `8px` | Cartão, botão |
| `--radius-lg` | `16px` | Painel, capa de livro, modal |
| `--radius-pill` | `999px` | Selo, filtro, avatar |

### 8.3 Sombra

Sombra de papel sobre papel, **quente**, tingida com o `ink` (`rgb(38 22 29)`) — nunca cinza neutro,
que sujaria o creme:

```css
--shadow-paper:  0 1px 2px rgb(38 22 29 / .06), 0 6px 16px rgb(38 22 29 / .08);
--shadow-lifted: 0 2px 4px rgb(38 22 29 / .08), 0 12px 28px rgb(38 22 29 / .12);
```

`--shadow-paper` para cartão em repouso; `--shadow-lifted` para hover e modal.

### 8.4 Largura e respiro

As páginas do brandbook são 1440×810 com margem de conteúdo de ~5% (≈72px). Daí:

| Token | Valor |
|---|---|
| `--container-max` | `1120px` |
| `--container-gutter` | `5vw`, mínimo `--space-4` |
| `--measure` | `68ch` (largura máxima de texto corrido) |

### 8.5 Breakpoints (E-10)

`--bp-sm: 480px` · `--bp-md: 768px` · `--bp-lg: 1024px` · `--bp-xl: 1280px`

Mobile-first. As peças da marca são todas verticais (4:5 e 9:16) — **o membro chega pelo celular**,
vindo do link da bio. Projete a Home para 390px primeiro.

### 8.6 Movimento (E-11)

Rápido e sem elasticidade: `--motion-fast: 120ms`, `--motion-base: 200ms`,
`--motion-slow: 320ms`, todos com `ease-out`. A marca é desenhada à mão, não animada; exagero de
movimento contradiz o "espaço para desacelerar" da seção 9. Respeite `prefers-reduced-motion`.

### 8.7 Dimensões de componente (E-13)

O resto da seção 8 dá espaçamento, raio, container e breakpoints, mas não desce ao tamanho dos
componentes em si — e a Fase 4 precisou desses tamanhos. Ficam registrados aqui para não
renascerem no CSS a cada tela nova. **Nenhum é do brandbook**; cada um se apoia numa regra que já
existia neste documento.

| Medida | Valor | De onde saiu |
|---|---|---|
| Logotipo no cabeçalho e no rodapé | `clamp(104px, 26vw, 132px)` | A faixa de 5.3 (mínimo 96px, alvo 120–140px). O piso subiu para 104px porque em 390px o logo divide a linha com o "Sair" |
| Capa de livro | proporção `2 / 3`, borda de `--space-2`, `--radius-lg` | Proporção corrente de capa; a borda creme grossa é o "recorte com borda branca" da seção 7 e o raio é o que 8.2 atribui a capa de livro |
| Coluna da capa no herói (≥768px) | `17rem` | Cerca de um quarto do `--container-max`, o suficiente para a capa não competir com o `h1` |
| Capa no celular | `min(15rem, 62vw)` | 62vw deixa o retalho xadrez deslocado e o selo caberem na coluna em 390px sem estourar a goteira |
| Elemento gráfico | `2rem` embutido em linha, `5rem` em estado vazio | Muito abaixo do teto de ~240px de 6.2, onde o traço texturizado esgarça |
| Avatar de leitor | `2.75rem` (44px) | É o alvo de toque de 10.4 reusado como diâmetro |
| Trilho da barra de progresso | `0.875rem` de altura, `--radius-pill` | Fino o bastante para informar sem virar medidor (seção 9); o raio é o do selo |
| Campo numérico | `6rem` de largura, `44px` de altura | Cabe quatro dígitos; a altura é o alvo de toque |
| Fio de aviso / borda de avatar | `3px` / `2px` | Mais grossos que o fio de 1px de `--clubi-line`, porque marcam estado e não podem depender só de cor (3.3) |
| Área de texto (Fase 5, `NewPost`/edição de post) | `8rem` de altura mínima | Cabe o corpo de um post curto sem rolagem; abaixo disso o membro perde a visão do que já escreveu antes de publicar |
| Botão de remover imagem em preparo (Fase 5) | `44px` de diâmetro | O mesmo alvo de toque de 10.4, reusado como diâmetro — mesma lógica do avatar de leitor acima |
| Proporção de imagem — publicação vs. capa (Fase 5) | `4 / 3` nas imagens já publicadas, `1 / 1` nas miniaturas em preparo | Diferente de `2 / 3` (capa de livro), de propósito: a publicação é foto de celular, não capa editorial; o quadrado nas miniaturas do formulário as distingue visualmente das imagens já publicadas antes de o post existir |
| Foto de perfil (Fase 6, `Profile`/`EditProfile`) | `clamp(6rem, 22vw, 8rem)`, borda de `--space-2`, `--radius-pill` | Cerca de metade da coluna de capa do herói (17rem): ancora o cabeçalho sem disputar atenção com o nome. A borda creme grossa é o mesmo "recorte com borda branca" da seção 7 já aplicado à capa de livro |
| Estrela de nota (Fase 6, `StarRating`) | glifo de `1.5rem` dentro de um alvo de `44px` | O alvo de toque de 10.4 — que nomeia as estrelas como um dos dois candidatos a errá-lo. O glifo em si fica muito abaixo do teto de ~240px de 6.2 e alinha com uma linha de texto |
| Meia estrela (`StarRating`, nota de 0,5 em 0,5) | cópia do mesmo glifo de `1.5rem` empilhada sobre o vazio, recortada por `overflow: hidden` a `50%` da largura | Não é medida nova, é a de cima usada duas vezes: a estrela cheia e a vazia já eram o mesmo desenho em cores diferentes (6.1), então a metade sai do mesmo arquivo em vez de um terceiro. O recorte é na largura do glifo, não na do alvo de `44px`, senão o corte cairia na folga em volta do desenho |
| Prévia de nota (`StarRating`, sob o cursor ou o dedo) | preenchimento a `opacity: .55`, legenda prefixada por `prévia:` | A prévia precisa se distinguir da nota já dada, e 10.3 proíbe que a distinção seja só de cor — daí o par: a opacidade é o sinal visual, a palavra na legenda é o que não depende de enxergar a diferença. Opacidade em vez de uma quinta cor porque a paleta é fechada (3.1) |
| Slot da estante de favoritos (Fase 6) | coluna mínima de `7rem`; 2 colunas até 768px, 4 acima | A estante tem quatro lugares fixos (ADR-08), então a grade é fixa e não auto-ajustável — uma grade que se ajusta sozinha diria que cabem mais. Abaixo de 7rem o título de um livro sem capa não cabe no placeholder tipográfico |
| Capa no histórico de leituras (Fase 6) | `5rem` | O mesmo valor que 6.2 dá ao elemento gráfico em estado vazio, reusado aqui para que um mês passado seja miniatura e não um segundo herói |
| Campo de busca no cabeçalho (Fase 7) | linha inteira até 768px; `22rem` acima | Em 390px o cabeçalho já estava cheio com logotipo e conta (ver a linha do logotipo acima), então o campo desce para a segunda linha em vez de espremer os dois. Acima de 768px, `22rem` cabe um nome completo com folga e ainda deixa o logotipo e a conta com a parte delas do `--container-max`. O painel de sugestões não tem medida própria: nasce da largura do campo, e o limite de cinco resultados é o que o impede de precisar de rolagem |
| Cartão de membro na busca (Fase 7) | coluna mínima de `16rem` | É a menor largura em que um nome de duas palavras ainda fica ao lado do avatar de `2.75rem` em vez de quebrar embaixo dele. Ao contrário da estante (quatro lugares fixos, ADR-08), aqui a grade *é* auto-ajustável: a lista de membros não tem número certo de lugares |
| Capa no resultado do catálogo externo (Fase 8, `BookPicker`) | `3rem` de largura | É a menor largura em que a capa ainda é uma imagem: a borda creme grossa que 8.7 dá a toda capa gasta `--space-2` de cada lado, então sobram `2rem` de desenho. Menor que a miniatura de `5rem` do histórico porque aqui é linha de painel e não seção de página — a `4,5rem` de altura que a proporção `2 / 3` produz é a de uma linha de resultado com duas linhas de texto, o que mantém a lista externa no ritmo da lista local logo acima. **Nesse tamanho o marcador tipográfico da capa some**: o `--space-4` de respiro dele é mais largo que os `2rem` disponíveis, e a linha já imprime título e autoria ao lado — um livro sem capa fica com a moldura vazia, que é o próprio sinal de "sem capa" |

---

## 9. Tom da interface

Isto **não é extrapolação** — é leitura direta do que as peças dizem, com todas as letras:

> "a gente não te cobra ter lido o livro inteiro"
> "nem julga se você não é 'leitor experiente'"
> "Aqui, não importa quantos livros você lê por ano. **O que importa é fazer parte.**"
> "faltava um espaço para desacelerar" · "um ambiente leve e cheio de boas histórias"
> "criado por estudantes para estudantes"

O clubi se define **contra** a cultura de métrica de leitura. Isso tem consequência direta de
produto, porque o backend expõe justamente progresso, nota e histórico:

**Obrigatório**

- `ProgressBar` **informa, não cobra.** Sem "você está atrasado", sem contagem regressiva, sem
  vermelho para progresso baixo. 8% lidos é uma leitura começada, e a interface celebra isso.
- **Sem ranking, sem ofensiva, sem comparação entre membros.** "Quem está lendo"
  (`GET /monthly-picks/current/readers`) é presença — companhia, não placar. Não ordene por
  progresso decrescente; não exiba "top leitores".
- **Nota e resenha são opcionais e reversíveis.** Nunca bloqueie um fluxo por falta de avaliação.
- **Estado vazio é convite.** Sem pick do mês (404) → "ainda não há livro do mês" com elemento
  `nuvem` e um caminho adiante. Perfil sem favoritos → convite para montar a estante, não "nenhum
  registro encontrado".
- **`você`, informal, segunda pessoa.** Nunca "o usuário", nunca "sua conta foi processada".
- **Erro explica e oferece saída.** O `{ "detail": ... }` da API já vem em pt-BR — renderize-o
  (regra do `frontend/CLAUDE.md`) e adicione o que fazer a seguir.
- **Controle é palavra, não símbolo** (6.3). "Publicar", "Ver mais", "Excluir" em vez de `+`,
  chevron e lixeira. Não é só coerência de marca: rótulo escrito é mais acessível que ícone sozinho,
  e a marca já resolve tudo com texto.

**Calibragem**

O tom é acolhedor, **não infantil**: são universitários da ESPM. Exclamação é pontual, não padrão.
Emoji não aparece em nenhuma peça — o `<3` de `post 2/5.png` é o limite, e é assinatura, não
elemento de interface. **Não use emoji na interface**; para isso existem os elementos gráficos.

---

## 10. Acessibilidade

Não negociável, e em parte já garantido pelas medições da seção 3.2:

1. **Texto corrido ≥ 4.5:1.** Os pares recomendados entregam 5.59–15.81. Laranja e amarelo estão
   fora de texto corrido por medição, não por gosto.
2. **Foco sempre visível**, nunca `outline: none`. Padrão: `2px solid var(--clubi-focus)` com
   `outline-offset: 2px`. Sobre fundo vinho, troque para `--clubi-highlight` (amarelo, 6.84).
3. **Cor nunca é o único sinal** — vale duplo para erro (ver alerta em 3.3).
4. **Alvo de toque ≥ 44×44px.** Os degraus da barra de progresso e as estrelas de nota são os
   candidatos a errar isso.
5. **Elementos decorativos com `aria-hidden="true"`**; o logo com `alt="clubi"`.
6. **Textura de grão não pode reduzir contraste** — mantenha ≤ 3% de opacidade e meça de novo.
7. **`prefers-reduced-motion`** desliga rotação decorativa e transições não essenciais.

**Não há tema escuro** e não deve haver por enquanto: a marca tem uma inversão própria
(creme ⇄ vinho) que já cumpre o papel expressivo. Um dark mode neutro exigiria uma quinta e sexta
cor fora do brandbook. Se for pedido, volta como decisão de arquitetura.

---

## 11. Bloco de tokens

Este é o conteúdo canônico de `frontend/src/styles/tokens.css`. Os mesmos valores de cor e fonte
precisam existir em `backend/core/static/css/auth.css` (seção 2).

```css
/* clubi — design tokens. Fonte: frontend/DESIGN.md. Não edite valores aqui sem atualizar o
   documento e o auth.css. */
:root {
  /* ---- Marca (literal, brandbook p.3) ---- */
  --clubi-wine:   #88013e;
  --clubi-cream:  #fdfae7;
  --clubi-yellow: #ffd071;
  --clubi-orange: #ed6630;

  /* ---- Superfícies ---- */
  --clubi-bg:             var(--clubi-cream);
  --clubi-bg-invert:      var(--clubi-wine);
  --clubi-surface:        #fefdf4;
  --clubi-surface-sunken: #f7eedf;
  --clubi-line:           #edd7cf;
  --clubi-line-strong:    #e1bebe;
  --clubi-line-invert:    #9d2e5c;

  /* ---- Texto ---- */
  --clubi-ink:                  #26161d;
  --clubi-ink-brand:            var(--clubi-wine);
  --clubi-ink-muted:            #716664;
  --clubi-ink-on-invert:        var(--clubi-cream);
  --clubi-ink-muted-on-invert:  #dcb4b8;

  /* ---- Ação ---- */
  --clubi-action:        var(--clubi-wine);
  --clubi-action-hover:  #780137;
  --clubi-action-active: #6a0130;
  --clubi-action-ink:    var(--clubi-cream);
  --clubi-accent:        var(--clubi-orange);
  --clubi-accent-hover:  #d15a2a;
  --clubi-accent-ink:    #290013;  /* mais escuro que --clubi-ink de proposito: passa AA no hover */
  --clubi-highlight:     var(--clubi-yellow);
  --clubi-highlight-ink: var(--clubi-wine);
  --clubi-focus:         var(--clubi-orange);

  /* ---- Tintas ---- */
  --clubi-tint-wine:   #f1e1d6;
  --clubi-tint-orange: #fadfc6;
  --clubi-tint-yellow: #fee7b2;

  /* ---- Estado (extrapolado — E-03) ---- */
  --clubi-danger:     #b83620;
  --clubi-danger-ink: #ffffff;
  --clubi-success:    #2f6b4f;
  --clubi-warning:    #8e3d1d;

  /* ---- Tipografia ---- */
  --clubi-font-display: "Clash Display", "Trebuchet MS", system-ui, sans-serif;
  --clubi-font-text:    "Manrope", system-ui, -apple-system, "Segoe UI", sans-serif;

  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-md:   1.25rem;
  --text-lg:   1.5rem;
  --text-xl:   2rem;
  --text-2xl:  2.5rem;
  --text-3xl:  3rem;
  --text-4xl:  4rem;

  --leading-display: 1.0;   /* brandbook: Clash 1.0 */
  --leading-tight:   1.1;   /* brandbook: Manrope 1.1 */
  --leading-snug:    1.4;
  --leading-body:    1.6;   /* E-04 */

  --tracking-display: 0;         /* brandbook: Clash 0 */
  --tracking-text:    -0.02em;   /* brandbook: Manrope -20 */

  /* ---- Espaçamento ---- */
  --space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
  --space-4: 1rem;     --space-5: 1.5rem;   --space-6: 2rem;
  --space-7: 3rem;     --space-8: 4rem;     --space-9: 6rem;

  /* ---- Forma ---- */
  --radius-none: 0;
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-pill: 999px;

  --shadow-paper:  0 1px 2px rgb(38 22 29 / .06), 0 6px 16px rgb(38 22 29 / .08);
  --shadow-lifted: 0 2px 4px rgb(38 22 29 / .08), 0 12px 28px rgb(38 22 29 / .12);

  /* ---- Layout ---- */
  --container-max:    1120px;
  --container-gutter: 5vw;
  --measure:          68ch;

  /* ---- Movimento ---- */
  --motion-fast: 120ms;
  --motion-base: 200ms;
  --motion-slow: 320ms;
  --motion-ease: cubic-bezier(0.2, 0, 0.2, 1);
}
```

> **Sobre Tailwind.** O guia (7.7) e o `frontend/CLAUDE.md` fecham a stack em CSS puro, sem framework
> de UI. Este bloco é o alvo real. Caso o Tailwind um dia entre — o que é desvio a levantar antes de
> escrever, não decisão deste documento —, os tokens mapeiam 1:1 para `theme.extend.colors`,
> `fontFamily`, `fontSize`, `spacing`, `borderRadius` e `boxShadow`, sem renomear nada.

---

## 12. Extrapolações

Tudo que **não** tem respaldo direto no brandbook. Cada item traz o que foi decidido, sobre o que se
apoiou e o que faria revisá-lo.

> **Revisadas em 2026-08-27.** O fundador passou pelas doze. A **E-01** mudou (o texto corrido
> deixou de carregar identidade); **E-03** e **E-12** foram mantidas como estavam; a **E-07** foi
> resolvida por adaptação em vez de biblioteca. Nas demais — E-02, E-04, E-05, E-06, E-08, E-09,
> E-10 e E-11 — não houve objeção, e elas passam de "extrapolação pendente" a **decisão aceita**.
> Continuam aqui, com o gatilho de revisão de cada uma, porque saber o que *não* veio do brandbook
> continua valendo quando alguém for mexer nisso daqui a seis meses.

| # | Decisão | Base | Quando revisar |
|---|---|---|---|
| **E-01** ✅ | **Decidido (2026-08-27): `--clubi-ink: #26161d`.** Texto corrido **não** carrega identidade | A proposta anterior (`#44001f`) tinha croma 32.9 — ameixa percebível em massa, não "quase preto" como descrito. Identidade mora no logo, títulos, blocos de cor e elementos; texto longo é para ser lido. Mas preto puro tem croma 0 e seria o único elemento frio numa paleta toda quente, com contraste 20:1 (mais duro que o usual). `#26161d` tem **croma 9.6 — o mesmo calor do papel creme (9.7)** — e contraste 16.47, na faixa confortável | Fechado. Reabrir só se a marca mudar de fundo |
| **E-02** | Estados hover/active por escurecimento de 12% e 22% | O brandbook é mídia estática e não tem estado interativo. Escurecer preserva o matiz | Se surgir peça com estado interativo definido |
| **E-03** ✅ | **Aprovado como está (2026-08-27):** erro `#b83620`, sucesso `#2f6b4f`, aviso `#8e3d1d` | Nenhum respaldo no brandbook. O vinho ocupa a faixa vermelha, então erro precisou de matiz próprio; sucesso exigiu um verde, cor que não existe na marca. **O fundador revisou e manteve** | Fechado. Continua valendo a regra de nunca sinalizar estado só com cor (ver 3.3) |
| **E-04** | Entrelinha 1.6 em texto corrido (brandbook diz 1.1) | 1.1 em parágrafo web é ilegível. O 1.1/1.0 foi preservado em display, onde o brandbook o aplicava | Não rever: é requisito de legibilidade |
| **E-05** | Escala tipográfica de 9 degraus, razão ~1.25 | O brandbook não define tamanhos. Razão conservadora, arredondada para pixel inteiro | Se o layout pedir salto maior entre `h1` e corpo |
| **E-06** | Respiro de 1/3 da largura; mínimo 96px | Medido do próprio arquivo: os PNGs trazem 216px laterais para 648px de mancha | Se sair um manual de logo formal |
| **E-07** ✅ | **Decidido (2026-08-27): sem biblioteca de ícones.** Elementos da marca no que é conteúdo, **palavra** no que é controle. Ver 6.3 | Os dez elementos cobrem bem o significado (nota, anexo, post, livro, vazio) mas não cobrem controle (fechar, menu, seta). Forçar a adaptação seria óbvio; adotar biblioteca traria traço estranho ao lado do desenho à mão. A marca já é verbal — todas as peças resolvem com texto | Se a densidade de interface crescer a ponto de o texto atrapalhar. Aí entram os 2 glifos de 6.3, desenhados no traço da marca |
| **E-08** | Textura de grão no fundo, ≤3% de opacidade | Todas as peças têm grão de papel. A opacidade é escolha nossa | Se afetar contraste ou peso de página |
| **E-09** | Rotação de ±1.5° só em decoração | As peças rotacionam selos e cartões livremente. Rotacionar conteúdo funcional quebra alinhamento e leitura | Se aparecer proposta de layout com rotação estrutural |
| **E-10** | Espaçamento, raio, breakpoints, container | Sem respaldo. Grade de 4px é convenção; o raio duplo (0 e pílula) foi observado nas peças; o container vem da margem de ~5% do brandbook | Convenção web padrão; baixo risco |
| **E-11** | Durações e curva de movimento | Sem respaldo — a marca é estática. Valores curtos por coerência com "leve" e "desacelerar" | Se entrar animação de marca |
| **E-12** ✅ | **Mantida (2026-08-27): sem tema escuro.** | A inversão creme ⇄ vinho já é o modo escuro da marca. Um dark neutro exigiria cores fora do brandbook. **O fundador revisou e manteve** | Se for pedido explicitamente — volta como ADR, não como ajuste de token |
| **E-13** ⏳ | **Dimensões de componente** — largura de logotipo, capa, avatar, trilho de progresso, campo numérico (seção 8.7, Fase 4), mais área de texto, botão de remover imagem e proporção de imagem de post (Fase 5), mais foto de perfil, estrela de nota, slot da estante e capa do histórico (Fase 6), mais campo de busca do cabeçalho e cartão de membro (Fase 7), mais recorte da meia estrela e prévia da nota, mais capa no resultado do catálogo externo (Fase 8) | Nasceu na Fase 4: a seção 8 dava espaçamento, raio, container e breakpoints, mas nenhum tamanho de componente, e a Home precisava deles. Cresceu na Fase 5, na Fase 6, na Fase 7, na nota com meia estrela e na Fase 8 pelo mesmo motivo — formulários de post, depois perfil e estante, depois a busca, depois a metade da estrela, depois a capa vinda da Open Library, precisavam de medidas que a seção 8 não cobria. Cada medida se apoia numa regra que já existia — o alvo de toque de 10.4, a faixa de logotipo de 5.3, o teto de ~240px de 6.2, o `--container-max` | **Pendente de revisão pelo fundador**, a única em aberto. Rever quando um componente novo pedir medida que não caiba nessas |

---

## 13. Pendências de asset

Resolvidas:

1. ~~Exportar SVG do logo~~ — **feito**, `src/assets/brand/logo-clubi.svg`, com `currentColor`
   cobrindo as três variantes (5.5).
2. ~~Converter as 4 fontes para `woff2`~~ — **feito**, `src/assets/fonts/`, 242 KB → 93 KB (4.2).
3. ~~Exportar SVG dos 10 elementos~~ — **feito**, `src/assets/elements/`, 97 KB (5.6).

Em aberto:

4. **Gerar os stickers faltantes** (`livro 2`, `estrela 1`) se forem usados sobre vinho — e note que
   os SVGs de 5.6 já resolvem a maior parte dos casos por `currentColor` (6.1).
5. ~~Decidir a família de ícones funcionais~~ — **decidido: não haverá.** Elementos da marca no
   conteúdo, palavra no controle (6.3, E-07). Os dois glifos residuais (`×` e menu) se desenham
   quando forem necessários, não antes.
6. ~~Realinhar `backend/core/static/css/auth.css`~~ — **feito** (seção 2). As páginas de
   `/accounts/` já estão na identidade da marca.
7. **Otimizar os SVGs** (SVGO ou equivalente) se o peso incomodar. `estrela-8` (28,8 KB) e
   `livro-fechado` (27,1 KB) carregam muito nó por causa da textura de pincel; os outros oito somam
   ~41 KB juntos. Não é urgente — é menos que uma foto de capa.
8. ~~Incluir `/static` no proxy do `vite.config.ts`~~ — **feito** na Fase 4. Fontes e logotipo
   chegam à SPA em `:5173` pelo proxy. Junto veio uma correção que o aviso de 2.1 não previa: o
   proxy também reescreve `Origin` e `Host` para o alvo, senão a verificação de origem do CSRF do
   Django recusa todo POST vindo de `:5173` — login, logout e o `PUT` de progresso inclusive.

## 14. O que de `frontend/clubi/` está no Git

Decidido em 2026-08-27: **a identidade visual entra; dado de pessoa não entra.**

**Versionado** — brandbook, `logo/`, `elementos/`, `tipografia/`, `posts/`, `redes sociais/`. São a
identidade e as peças publicadas, e é o lastro que torna este documento auditável: sem elas,
"rastreável ao brandbook" vira promessa sem prova.

**Fora do Git**, via `.gitignore`:

| Excluído | Motivo |
|---|---|
| `documentos/` | **Dados pessoais.** `interessados _ clubi (respostas).xlsx` é lista de contatos e `Planilha de Gastos _ Clubi.xlsx` é financeiro do clube. Nada disso é identidade visual, e histórico de Git não esquece. |
| `arquivos abertos/` | O `.ai` tem **103 MiB e o GitHub recusa arquivo acima de 100 MiB** — não é preferência, é limite rígido. Some-se que ele é uma **versão superada** (5.6): quem abrisse encontraria paleta e tipografia erradas. Tudo que ele tinha de aproveitável já saiu dele e está em `src/assets/`. |

Se um dia o `.ai` precisar ser versionado, o caminho é **Git LFS** — e aí vale rever se não é melhor
salvar uma versão enxuta, sem as fotos do moodboard, que é o que faz o arquivo pesar.

> O arquivo-mestre continua existindo fora do Git. **Ele não some por não estar versionado** — mas
> também não tem backup pelo repositório, então guarde-o em outro lugar (Drive do clube).
