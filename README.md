# clubi

**O clube do livro na ESPM.** Todo mês o clube lê um livro junto; aqui cada
membro marca por onde está, dá sua nota, escreve a resenha e acompanha as postagens
de quem organiza.

<!-- DEPLOY:demo-link -->

## Estado

<!-- DEPLOY:status -->
Backend, interface e admin estão completos e rodam localmente; o projeto ainda não
tem ambiente público — para ver funcionando, é [rodar local](#rodando-localmente).

<!-- DEPLOY:screenshots -->
<!-- TODO: screenshot da home com o livro do mês, tirada do ambiente local. -->

## O que dá para fazer

Do ponto de vista de quem é do clube:

- **Ver o livro do mês** na página inicial — capa, autor e o texto que o clube
  escreveu sobre a escolha.
- **Marcar o progresso da leitura** quando quiser, sem ninguém cobrando página.
- **Dar nota e escrever a resenha** ao terminar — a nota aceita meia estrela.
- **Ver quem já terminou** a leitura deste mês.
- **Percorrer as escolhas anteriores**, mês a mês, desde a primeira.
- **Ler as postagens do clube**, com imagens, e saber quantas chegaram desde a
  última visita.
- **Montar a estante**: quatro livros favoritos no perfil, buscados no acervo do
  clube ou na Open Library.
- **Ter um perfil** com foto, uma frase e o histórico de todas as leituras.
- **Procurar outros membros** pelo nome.

Quem organiza o clube publica as postagens e define a escolha do mês pelo Django
Admin: ler é de todo membro, escrever é da organização. Tudo acima é para quem
entrou — a API é fechada por padrão (ADR-19), e a única página aberta a quem não
é do clube é a de apresentação.

## Stack

| Peça | O que faz aqui | Por que ela |
|---|---|---|
| **Django 6** | ORM, autenticação, admin | o clube precisa de painel administrativo e login prontos no primeiro dia, não de async (ADR-01) |
| **Django Ninja** | a API em `/api/`, com schemas Pydantic e docs em `/api/docs` (em desenvolvimento, ou para a organização) | ergonomia de API tipada sem abrir mão do ORM e do Admin, que são o motivo de estar no Django (ADR-02) |
| **React 19 + TypeScript** | a interface do membro, uma SPA servida pelo próprio Django | a API como caminho principal de dados é objetivo declarado do projeto, não exigência do produto (ADR-03) |
| **Vite 8** | build da SPA e dev server | em desenvolvimento faz proxy de `/api`, `/admin`, `/accounts`, `/media` e `/static` para o Django, o que preserva a origem única |
| **TanStack Query** | cache, revalidação e estado das chamadas à API | a maior parte do estado da SPA é estado de servidor; guardá-lo à mão seria reescrever isso pior |
| **PostgreSQL** | o banco para o qual o projeto foi escrito (`psycopg`) <!-- DEPLOY:banco --> | o desenvolvimento local roda em SQLite, e há teste de migração para que a diferença não passe despercebida |
| **Cloudflare R2** | fotos de perfil e imagens das postagens | disco de host é efêmero, então o upload vai para object storage desde o primeiro dia (ADR-11); sem credencial configurada, cai em `backend/media/` |
| **openapi-typescript** | gera `frontend/src/api/generated.ts` a partir do schema OpenAPI | o contrato da API não é redigitado à mão no frontend, e `tsc --noEmit` avisa quando ele muda (ADR-12) |

## Como as peças se encaixam

Um repositório, duas pastas, **uma única origem**. Não há CORS nem JWT: a SPA é
servida pelo próprio Django e conversa com `/api/` usando o cookie de sessão mais
um header `X-CSRFToken`.

```
navegador
   ├── /            → apresentação em HTML para o visitante; a Home da SPA para quem entrou
   ├── /accounts/   → login, cadastro e recuperação de senha (páginas renderizadas)
   ├── /admin/      → Django Admin, por onde o clube é operado
   ├── /api/…       → JSON (Ninja)  ←── consumido pelo React
   └── /*           → o shell da SPA
```

Quatro consequências que valem saber:

- **A autenticação mora em views renderizadas, não na API** (ADR-05). Não existem
  endpoints de login ou de senha no Ninja; o sinal que a SPA usa é `GET /api/me`
  responder 401.
- **`/` devolve dois documentos conforme o cookie** (ADR-18). O visitante anônimo
  recebe HTML puro — o que dá preview de link decente no WhatsApp e no Instagram,
  já que crawler de rede social não executa JavaScript. Quem entrou recebe a SPA.
- **O admin é produto, não bastidor** (ADR-14). Configurar o admin faz parte de
  adicionar um modelo, e é por isso que há coisas que a SPA nunca precisou de tela.
- **A API é fechada por padrão** (ADR-19). Rota que não diz nada sobre autenticação
  nasce exigindo login, e a lista de exceções públicas está vazia — perfil, acervo,
  feed e seleções do mês inclusive. A apresentação em `/` lê o livro do mês direto
  pelo ORM, então ela não depende de nenhuma rota aberta.

## As decisões estão escritas

O documento mais útil deste repositório não é código:
**[`clubi-decisoes-de-arquitetura.md`](clubi-decisoes-de-arquitetura.md)** registra
19 decisões estruturais, cada uma com o contexto que a motivou, as alternativas
descartadas, as consequências assumidas — as boas e as ruins — e o critério para
revisá-la. A ideia é que daqui a seis meses ninguém precise reconstruir o raciocínio
do zero, nem reabrir uma discussão encerrada achando que ela ficou em aberto.

Uma amostra:

| | |
|---|---|
| **ADR-04** | Mesma origem e sessão, porque evita uma classe inteira de problemas que só existe depois de separar. |
| **ADR-06 / 07** | `MonthlyPick` e `MonthlyReading` como entidades próprias, porque o histórico é requisito e um booleano `is_book_of_the_month` o destruiria. |
| **ADR-15** | Cada app é dono da sua fatia da API, porque schema de resposta pertence à rota, não à entidade que ele cita. |
| **ADR-13** | Render, Neon e R2, com o limite de cada tier gratuito escrito por extenso — inclusive o que custam quando deixarem de bastar. |
| **ADR-19** | A API é fechada por padrão, porque data de nascimento e resenha de estudante não são conteúdo de web aberta — e porque abrir depois é uma linha, enquanto fechar depois de indexado não desfaz nada. |

## Identidade visual

O clubi tinha marca antes de ter site: um brandbook, três variantes de logotipo,
duas famílias tipográficas e um conjunto de elementos gráficos já em uso nas redes
do clube. [`frontend/DESIGN.md`](frontend/DESIGN.md) traduz isso para a web e é
leitura obrigatória antes de qualquer CSS — nenhuma cor, fonte, medida ou escolha de
tom entra no código sem estar lá. O documento também mantém uma lista numerada de
**extrapolações**: as decisões que a web exigiu e o brandbook não cobre (estados de
hover, cores de erro, escala tipográfica, breakpoints), separadas justamente para que
o fundador possa contestar uma a uma as que não vieram da marca.

## Rodando localmente

Requisitos: **Python 3.12+**, **[uv](https://docs.astral.sh/uv/)** e **Node 20.19+**
(o Vite 8 quebra em Node 18 com um erro que não diz que é disso que se trata).

```bash
git clone <url-do-repositorio> && cd clubi
cp backend/.env.example backend/.env
make install        # uv sync no backend, npm ci no frontend
make migrate
cd backend && uv run manage.py createsuperuser
```

<!-- DEPLOY:env-producao -->
O `.env` cobre `SECRET_KEY`, hosts permitidos, credenciais do R2 e SMTP. Para
desenvolver, os valores do `.env.example` bastam: sem R2 os uploads vão para
`backend/media/`, e os e-mails de recuperação de senha saem no console.

Depois disso são dois processos, em dois terminais:

```bash
make dev-backend     # Django em :8000
make dev-frontend    # Vite em :5173
```

Abra **`localhost:5173`** — é o par que exercita o proxy, e portanto o mesmo caminho
que o código percorre depois. A página de apresentação é a única exceção: como `/` é
a raiz da SPA, ela não passa pelo proxy e só aparece em `localhost:8000`, numa janela
anônima. O conteúdo do clube — livro do mês, postagens, membros — se cria pelo
`/admin/`, com o superusuário recém-criado.

Os outros alvos do `Makefile`: `make types` regenera os tipos do frontend a partir do
schema da API, `make lint` passa o ruff no backend, `make build` compila a SPA e
coleta os estáticos.

> Se `make` não existir na sua máquina, provavelmente o Make veio do MSYS2 e se chama
> `mingw32-make`. O `Makefile` está bem; é só o nome do binário.

## Testes

`make check` roda a verificação inteira: `manage.py check` e o pytest no backend,
depois `tsc --noEmit`, o vitest e o build da SPA no frontend. Os testes de backend
ficam junto do app que testam (`books/test_api.py`, `users/test_auth.py`,
`core/test_views.py`, …), incluindo um sobre as migrações. No frontend, o vitest
cobre a lógica pura — a que erra em silêncio, como a escala de notas e a
normalização dos resultados da Open Library — mais o redirecionamento de login do
`client.ts`. No backend, `api/test_policy.py` varre as rotas registradas e exige 401
de cada uma para quem não entrou, de modo que uma rota nova desprotegida reprova a
suíte em vez de passar despercebida.

## Estrutura

```
backend/     Django: os apps users, books, posts, core e api
frontend/    a SPA em React, mais a identidade visual em frontend/clubi/
clubi-decisoes-de-arquitetura.md    os 19 ADRs
Makefile     install · dev-backend · dev-frontend · types · migrate · build · check · lint
```

Cada uma das duas pastas tem o seu próprio `CLAUDE.md`, com as regras que valem só ali.
