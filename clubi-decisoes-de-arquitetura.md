# Clubi — Decisões de arquitetura

Registro das decisões estruturais do projeto, com o contexto que as motivou, as alternativas descartadas e as consequências assumidas. O objetivo é que daqui a seis meses — ou quando entrar alguém novo — ninguém precise reconstruir o raciocínio do zero.

**Este é um documento vivo, não um log.** Cada ADR descreve a decisão **vigente**. Quando um ADR posterior corrige um anterior, a correção entra no texto do anterior e a trajetória vira uma linha de **Histórico**. Um ADR lido isoladamente não deve informar nada que outro desminta.

Formato: **Contexto**, **Decisão**, **Alternativas consideradas**, **Consequências** (boas e ruins), **Quando revisar** e, quando houver, **Histórico**.

**Índice**

| | Decisão | Status |
|---|---|---|
| ADR-01 | Django como plataforma | Aceito |
| ADR-02 | Django Ninja como camada de API | Revisado |
| ADR-03 | SPA separada, mesmo repositório | Aceito |
| ADR-04 | Mesma origem, autenticação por sessão | Revisado |
| ADR-05 | Autenticação em views renderizadas | Aceito |
| ADR-06 | Livro do Mês como entidade própria | Aceito |
| ADR-07 | `MonthlyReading` unifica progresso e histórico | Aceito |
| ADR-08 | Listas de tamanho fixo como tabelas com `position` | Aceito |
| ADR-09 | Modelo de usuário customizado desde o dia 1 | Aceito |
| ADR-10 | Autor do livro como texto | Aceito |
| ADR-11 | Object storage desde o primeiro upload | Aceito |
| ADR-12 | Tipos do frontend gerados do OpenAPI | Revisado |
| ADR-13 | Render, Neon e Cloudflare R2 | Aceito |
| ADR-14 | Admin como produto da primeira entrega | Aceito |
| ADR-15 | Apps autocontidos, não um app de API central | Aceito |
| ADR-16 | Ferramental de desenvolvimento do frontend | Revisado (16b) |
| ADR-17 | Brandbook como fonte da verdade visual | Aceito |
| ADR-18 | Página de apresentação renderizada em `/` | Revisado |
| ADR-19 | API fechada por padrão | Aceito |
| ADR-20 | Sentry para erros, com o payload decidido antes do DSN | Aceito |

**Revisado** quer dizer que a decisão continua de pé, mas parte do texto original foi corrigida por um ADR posterior — a correção já está incorporada e o **Histórico** ao fim do ADR diz o que mudou.

---

## ADR-01 — Django como plataforma
**Status:** Aceito  ·  **Em uma frase:** Django porque o clube precisa de Admin, autenticação e upload prontos, não de async.

**Contexto.** O Clubi é um site de clube de leitura com autenticação, perfis, upload de imagens e uma operação editorial recorrente: alguém precisa eleger o Livro do Mês todo mês. A equipe é de uma a duas pessoas, com prazo de semestre.

**Decisão.** Django como framework de backend.

**Alternativas consideradas.**

*FastAPI.* Descartado. O que ele oferece de diferencial — async por padrão, alta concorrência, I/O externo pesado — não é exercido por este projeto. O único ponto assíncrono plausível é a consulta à API externa de livros, que acontece cerca de doze vezes por ano. Em contrapartida, seria preciso construir do zero: autenticação completa (hash, sessão ou token, reset de senha com token expirável e e-mail), interface administrativa, tratamento de upload e migrations via Alembic. São semanas de trabalho em código que não é o produto.

*Flask.* Mesma objeção, com menos recursos que o FastAPI.

**Consequências.**
- Positivas: ORM, migrations, autenticação, Admin, gerenciamento de arquivos e sistema de permissões prontos. Ecossistema maduro e documentação em português abundante.
- Negativas: o ORM do Django é difícil de tipar estaticamente; o SQLAlchemy seria superior em consultas complexas. O Clubi é essencialmente CRUD, então essa perda é teórica.

**Quando revisar.** Se surgir um requisito de tempo real (chat, presença ao vivo) com muitas conexões simultâneas, ou se o projeto passar a fazer dezenas de chamadas externas concorrentes por requisição.

---

## ADR-02 — Django Ninja como camada de API
**Status:** Revisado (ver histórico)  ·  **Em uma frase:** Django Ninja dá a ergonomia moderna de API sem abrir mão do ORM e do Admin.

**Contexto.** Escolhido o Django (ADR-01), resta decidir como o backend expõe dados: templates renderizados, Django REST Framework ou Django Ninja.

Vale registrar que **DRF e Ninja não são alternativas ao Django** — rodam dentro dele, sobre o mesmo ORM, Admin e autenticação. A escolha é de camada, não de plataforma.

**Decisão.** Django Ninja, com todos os endpoints sob `/api/`.

**Alternativas consideradas.**

*DRF.* Descartado. O ecossistema dele (viewsets, permissions granulares, throttling, versionamento, filtros) compensa a partir de uma escala de recursos que o Clubi não tem. Com pouco mais de vinte endpoints — 24 hoje —, paga-se a cerimônia sem receber o benefício. Além disso, o DRF não gera documentação OpenAPI sem pacote adicional e não tem suporte a async.

*Templates apenas.* Tecnicamente suficiente e mais rápido de entregar, mas incompatível com ADR-03.

**Consequências.**
- Positivas: schemas Pydantic com validação declarativa, documentação OpenAPI automática em `/api/docs` (em produção restrita a `is_staff`, ver ADR-19), tipagem estática que atravessa até o frontend (ADR-12). Ergonomia próxima à do FastAPI, que atende ao objetivo de aprendizado sem sair do Django.
- Negativas: comunidade menor que a do DRF; menos respostas prontas em fóruns.

**Quando revisar.** Se a API crescer muito e surgirem padrões repetitivos (filtros, permissões por objeto em dezenas de rotas), o DRF passa a ser um ganho real.

**Onde esse código mora** é assunto do ADR-15. **Quem pode chamar** é assunto do ADR-19.

**Histórico.** A contagem de endpoints e a disponibilidade do `/api/docs` foram atualizadas em 2026-09-23; a segunda mudou pelo ADR-19 (2026-09-11).

---

## ADR-03 — SPA separada, mesmo repositório
**Status:** Aceito  ·  **Em uma frase:** A API é o caminho principal de dados por um objetivo de aprendizado declarado — e, dado isso, o mono-repo é o arranjo mais simples, não uma concessão.

**Contexto.** Existem três arranjos possíveis: (1) templates renderizados no servidor; (2) SPA e API no mesmo repositório, com deploy coordenado; (3) SPA e API em repositórios e deploys independentes.

Pela análise puramente técnica, o nível 1 seria o indicado: um único consumidor, estado da interface derivável da URL, equipe mínima.

**Decisão.** Nível 2 — `backend/` e `frontend/` no mesmo repositório, um único deploy. São duas decisões encadeadas, com critérios diferentes.

### 3a — Adotar a API como caminho principal de dados (nível 1 → nível 2)

**Critério: não-técnico, declarado.** O objetivo do projeto não é apenas entregar o site: é servir de aprendizado e portfólio para os membros envolvidos. A equipe já domina views e templates Django, de modo que o nível 1 teria aprendizado marginal próximo de zero, enquanto React, TypeScript e consumo de API são exatamente o que uma vaga júnior pede. Esse é um objetivo legítimo — desde que registrado com esse nome, e não disfarçado de necessidade de engenharia.

O nível 1 seria a escolha correta se o critério fosse apenas velocidade de entrega. Nele o Ninja continuaria existindo e sendo usado de fato — favoritos, autocompletes, proxy da API de livros —, apenas com cerca de quatro endpoints em vez de vinte, e com o HTML como caminho principal. A diferença entre os níveis é de proporção, não da existência da API.

É a única decisão de *arquitetura* do projeto tomada por critério não-técnico. O ADR-14 também responde a um critério que não é técnico — risco de cronograma —, mas o que ele decide é ordem de entrega, não estrutura.

### 3b — Um repositório, não dois (nível 2, não nível 3)

**Critério: técnico.** Dada a decisão 3a, o mono-repo é o caminho **mais simples**, não uma concessão. A separação em dois repositórios codifica uma fronteira organizacional — times distintos com ciclos de release independentes. Com uma ou duas pessoas, ela só cobra imposto: PRs pareados, ordem de deploy, tipos duplicados, ambiente local mais complexo, e a impossibilidade de mudar contrato e consumidor no mesmo commit.

Importante: nos níveis 2 e 3 **a API é consumida de forma idêntica em runtime**. O mesmo `fetch`, o mesmo JSON. A diferença é inteiramente de build, deploy e organização.

O mono-repo é também a precondição do ADR-04 (mesma origem, sem CORS nem JWT) e do ADR-12 (tipos gerados sem publicar pacote).

**Consequências.**
- Positivas: aprendizado alinhado ao mercado; separação real de responsabilidades; a API já nasce como contrato legível para um eventual app mobile — com a ressalva do ADR-04 de que a sessão não serve a cliente nativo, então o que está pronto é a forma dos dados, não a autenticação.
- Negativas: as **telas do produto** perdem os Django Forms (o formset das 4 imagens vira upload manual pela API) e a renderização no servidor. As telas de autenticação (ADR-05) e a apresentação em `/` (ADR-18) continuam renderizadas, e não por acidente: são justamente onde o HTML no primeiro byte vale mais que o React. Surge também estado duplicado entre banco e cliente, com a classe de problemas de cache que isso implica. O cronograma alonga.
- Mitigação do risco de cronograma: ver ADR-14.

**Quando revisar.** Se o projeto atrasar a ponto de ameaçar a entrega ao clube, o fallback é o Admin (ADR-14), não uma volta ao nível 1.

---

## ADR-04 — Mesma origem, autenticação por sessão
**Status:** Revisado (ver histórico)  ·  **Em uma frase:** Mesma origem e cookie de sessão eliminam uma classe inteira de problemas que só existe quando se separam as origens.

**Contexto.** Escolhido o nível 2, é preciso decidir como a SPA se autentica na API.

**Decisão.** Frontend e backend respondem na **mesma origem**. A SPA usa o cookie de sessão do Django e envia o header `X-CSRFToken`. Em desenvolvimento, o Vite faz proxy de `/api`, `/admin`, `/accounts`, `/media` e `/static` para o Django; em produção, o Django serve o `index.html` do build — exceto em `/`, que desde o ADR-18 ramifica na sessão. A raiz **não** entra no proxy: ela é a própria raiz da SPA em `:5173`.

**Alternativas consideradas.**

*Origens distintas com JWT.* É o arranjo default de tutoriais e foi descartado deliberadamente. Ele traz uma cadeia inteira de problemas — CORS, escolha entre `localStorage` (vulnerável a XSS) e cookie, refresh token, revogação, expiração — que **existe apenas porque as origens foram separadas**. Nenhum desses problemas é do domínio do Clubi.

**Consequências.**
- Positivas: zero configuração de CORS; `request.user` funciona nos endpoints exatamente como funcionaria numa view; logout é imediato e real.
- Negativas: um app mobile nativo futuro não pode usar sessão e precisaria de um esquema de token adicional. É um problema aditivo, não bloqueante.

**A proteção CSRF não vem da mesma origem — vem do `auth=`.** O django-ninja marca toda view da API com `csrf_exempt` no nível do middleware e delega a checagem à classe de auth. Hoje ela está ativa em toda escrita porque o `django_auth` é global (ADR-19) e o `SessionAuth` a aplica em todo método inseguro. Antes disso, uma rota sem `auth=` nascia sem proteção nenhuma. Mesma origem é o que torna a sessão utilizável; não é o que protege a escrita.

**Quando revisar.** Ao construir um cliente que não seja o navegador na mesma origem.

**Histórico.** O texto original creditava a proteção CSRF à mesma origem e listava quatro caminhos no proxy do Vite. Corrigido em 2026-09-23: o proxy tem cinco, e a proteção depende do `auth=django_auth` que o ADR-19 (2026-09-11) tornou global.

---

## ADR-05 — Autenticação em views renderizadas
**Status:** Aceito  ·  **Em uma frase:** Login, cadastro, logout e reset de senha ficam em views Django renderizadas, porque é a área onde um erro tem consequência de segurança real e o Django já acertou.

**Contexto.** Mesmo com a interface principal em React, o fluxo de autenticação precisa existir: login, cadastro, logout e recuperação de senha.

**Decisão.** Essas telas ficam em views Django renderizadas, sob `/accounts/`. Não há endpoints de autenticação na API.

**Por que não reimplementar.** A linha `path("accounts/", include("django.contrib.auth.urls"))` entrega seis views prontas — login, logout e o fluxo completo de reset de senha, com token assinado, expiração e envio de e-mail. **Cadastro não está entre elas**: a `SignupView` é do projeto, registrada antes do `include` junto com o `LoginView` que usa o `LoginForm` próprio. Reimplementar o resto em React consumiria cerca de duas semanas em código que não agrega nada ao portfólio — e é justamente a área onde um erro tem consequência de segurança real.

**Alternativas consideradas.**

*Telas de autenticação na SPA, com endpoints de auth no Ninja.* Descartada pelo parágrafo acima: duas semanas para reescrever pior o que já existe testado, na única área do projeto onde um bug é uma falha de segurança.

**Consequências.**
- Positivas: segurança testada por padrão; economia grande de tempo; a fronteira é limpa e fácil de justificar.
- Negativas: uma descontinuidade visual entre as páginas de login e a SPA — a **única desvantagem real desta decisão**. A mitigação é os dois lados carregarem os mesmos tokens: hoje `backend/core/static/css/tokens.css` e `frontend/src/styles/tokens.css`, gêmeos declarados com a paleta da marca (ADR-17, ADR-18). Mudar um sem o outro reabre a costura.

**Fluxo definido.** Usuário anônimo abre a SPA → `/api/me` responde 401 → o cliente redireciona para `/accounts/login/?next=…` → após autenticar, volta com sessão válida. Um deep link como `/posts` percorre esse caminho inteiro; `/` não, porque desde o ADR-18 ele responde a landing renderizada a quem não tem sessão.

**Quando revisar.** Se o cadastro precisar de passos que um formulário renderizado não dê conta — confirmação por e-mail em várias etapas, convite com código. Aí a pergunta é sobre a tela de cadastro, que já é nossa, não sobre trazer o reset de senha para a API.

**Histórico.** O texto original atribuía o cadastro às views do `django.contrib.auth`. Corrigido em 2026-09-23: a `SignupView` sempre foi do projeto.

---

## ADR-06 — Livro do Mês como entidade própria
**Status:** Aceito  ·  **Em uma frase:** O Livro do Mês é uma entidade própria, `MonthlyPick`, porque um booleano no `Book` destruiria o histórico a cada virada de mês.

**Contexto.** O sketch original modelava o Livro do Mês como um booleano `isLivroDoMes` no próprio `Book`.

**Decisão.** Criar `MonthlyPick`, com FK para `Book`, `month` única e período de vigência. O booleano não existe.

**Alternativas consideradas.**

*O booleano `isLivroDoMes` no `Book`.* Descartado por três falhas. Eleger novembro exige desmarcar outubro, e nesse instante a informação de que outubro existiu desaparece — o histórico de avaliações no perfil, que é requisito, se torna impossível de reconstruir. O mesmo livro nunca poderia ser escolhido de novo anos depois. E não haveria onde guardar o que é do clube e não do livro: período de leitura, justificativa da escolha, data da discussão.

**Consequências.**
- Positivas: histórico preservado por construção; releitura possível; `on_delete=PROTECT` impede que apagar um livro destrua o histórico de todos.
- Negativas: uma consulta a mais para descobrir o livro vigente. Encapsulada em `MonthlyPick.current()`.

**Quando revisar.** Se o clube passar a eleger mais de um livro por mês, ou a deixar uma escolha atravessar dois meses — `month` é única, e é ela que sustenta a unicidade de `MonthlyReading` no ADR-07.

---

## ADR-07 — `MonthlyReading` unifica progresso e histórico
**Status:** Aceito  ·  **Em uma frase:** Progresso e histórico são o mesmo registro — `MonthlyReading` — observado em momentos diferentes.

**Contexto.** O sketch listava, como campos separados do usuário, "progresso/avaliação (livro do mês)" e "histórico de avaliações dos livros do mês".

**Decisão.** Um único modelo `MonthlyReading`, com unicidade em `(user, pick)`.

**Alternativas consideradas.**

*Dois campos separados no usuário, como no sketch.* Descartado: são o mesmo registro observado em momentos diferentes. O progresso atual é o `MonthlyReading` cuja seleção está vigente; o histórico é o conjunto de todas elas. Separá-los criaria duplicação de verdade e um bug previsível — na virada do mês, o progresso anterior seria sobrescrito.

**Consequências.**
- Positivas: uma fonte de verdade; o histórico é subproduto automático; a média de notas de um livro é uma agregação simples.
- Negativas: nenhuma relevante.

**Regra de negócio associada.** O registro nasce por `get_or_create` no primeiro clique de progresso. O usuário nunca "entra" no livro do mês explicitamente.

**Nota sobre o nome.** Chama-se `MonthlyReading`, e não `Reading`, porque a tabela **só existe atrelada a um `MonthlyPick`** — nunca a um livro qualquer do acervo. O acesso `user.readings` sugeriria erradamente um histórico de leituras em geral; `user.monthly_readings` diz o que é. Também não é `Review` porque a linha existe desde o primeiro clique de progresso, quando ainda não há nota nem resenha.

**Quando revisar.** Se o clube passar a registrar leituras fora do Livro do Mês. Aí `MonthlyReading` deixa de ser o histórico inteiro, e a pergunta a fazer não é esta de novo: é se nasce um `Reading` ao lado ou se este modelo se generaliza.

---

## ADR-08 — Listas de tamanho fixo como tabelas com `position`
**Status:** Aceito  ·  **Em uma frase:** Lista de tamanho fixo vira tabela com `position`, porque a ordem importa e banco relacional não guarda array de chave estrangeira.

**Contexto.** O sketch previa `Livros (favoritos apenas)[4]` no usuário e `images[4]` no post.

**Decisão.** Modelos intermediários `Favorite` e `PostImage`, ambos com campo `position` e `CheckConstraint` limitando a 1–4.

**Alternativas consideradas.**

*Array de chaves estrangeiras no próprio modelo, como o sketch previa.* Descartado: banco relacional não guarda isso de forma satisfatória, e em ambos os casos a ordem importa — qual favorito aparece primeiro na estante, qual imagem é a capa do post.

**Consequências.**
- Positivas: ordenação explícita; unicidade de slot garantida no banco; fácil evoluir o limite de 4 para outro valor.
- Negativas: uma tabela a mais para cada lista.

**Decisão de API relacionada.** A estante é salva por substituição atômica (`PUT /api/me/favorites` com os quatro itens), não por endpoints de adicionar, remover e reordenar. Reordenação é a operação mais comum e seria a mais desajeitada no modelo incremental.

**Quando revisar.** Se o limite de 4 virar configurável por usuário, ou se a lista crescer a ponto de a substituição atômica ficar cara — em quatro itens ela é trivial.

---

## ADR-09 — Modelo de usuário customizado desde o dia 1
**Status:** Aceito  ·  **Em uma frase:** O modelo de usuário é customizado antes da primeira migration, porque trocá-lo depois custa dias em vez de minutos.

**Contexto.** O Clubi precisa de campos que o usuário padrão do Django não tem: nome completo, data de nascimento, foto e quote.

**Decisão.** `User(AbstractUser)` com `AUTH_USER_MODEL` definido **antes da primeira migration**.

**Alternativas consideradas.**

*`Profile` com relação um-para-um com o `User` padrão.* Descartada: adiciona um join em praticamente toda consulta e a possibilidade de perfil ausente.

*Adiar a troca para quando fizer falta.* Descartada, e é o ponto inteiro deste ADR — que é de sequenciamento, não de design. Trocar o modelo de usuário depois que o banco existe é notoriamente doloroso no Django e envolve migrations manuais arriscadas. O custo de fazer certo no início é de minutos; o de corrigir depois, de dias.

**Consequências.**
- Positivas: os campos do domínio moram no usuário, sem join; a porta para qualquer campo futuro já está aberta.
- Negativas: nenhuma relevante — o custo foi pago antes de haver custo.

**Quando revisar.** Não se revisa. A janela em que essa decisão podia ser tomada fechou na primeira migration.

---

## ADR-10 — Autor do livro como texto
**Status:** Aceito  ·  **Em uma frase:** `Book.author` é texto, porque página de autor não é requisito e uma FK traria deduplicação que não se paga.

**Decisão.** `Book.author` é `CharField`, não uma FK para um modelo `Author`.

**Alternativas consideradas.**

*FK para um modelo `Author`.* Descartada. Página de autor não é requisito do Clubi, e a FK criaria imediatamente um problema de deduplicação — "Machado de Assis" contra "ASSIS, Machado de" contra "Machado de Assis (1839-1908)" — cujo custo de manutenção não se paga.

**Consequências.**
- Positivas: cadastrar um livro é digitar um campo; não há tabela de autores para manter limpa.
- Negativas: "todos os livros do autor X" não é consulta possível, e grafias divergentes convivem no acervo.

**Quando revisar.** Quando página de autor virar requisito. A migração é direta — criar o modelo, popular a partir dos textos distintos, converter o campo — e é aí que a deduplicação adiada chega para ser paga de uma vez.

---

## ADR-11 — Object storage desde o primeiro upload
**Status:** Aceito  ·  **Em uma frase:** Toda mídia vai para o Cloudflare R2 desde o primeiro upload, porque o disco das plataformas de deploy é efêmero.

**Contexto.** O Clubi tem imagens em três lugares: foto de perfil, capa de livro e até quatro imagens por post.

**Decisão.** Toda mídia vai para o Cloudflare R2 via `django-storages`, configurado antes do primeiro upload. Todo upload passa por compressão (redimensionamento para 1600px de largura, JPEG qualidade 82).

**Por que antes do primeiro upload.** O sistema de arquivos das plataformas de deploy usadas é efêmero: toda mídia enviada pelos usuários desapareceria no próximo deploy. Não é otimização, é requisito de correção. A compressão é o que mantém o consumo dentro do plano gratuito e as páginas rápidas.

**Alternativas consideradas.**

*Volume persistente no provedor de hospedagem.* Descartada: prende o projeto a um fornecedor, não tem CDN e sai mais caro.

*Storage local até doer.* Descartada pelo que acontece no meio: a dor só aparece depois que a primeira foto de perfil de um membro sumiu, e ela não volta.

**Consequências.**
- Positivas: mídia sobrevive a deploys; egress gratuito no R2; trocar de provedor é mudar o `settings.py`.
- Negativas: uma credencial a mais para gerenciar; ambiente local precisa de configuração equivalente (ou storage local em desenvolvimento).

**Quando revisar.** Se o egress deixar de ser gratuito no R2, ou se o consumo passar o plano gratuito. Nos dois casos a decisão a tomar é de fornecedor, não de arquitetura, e cabe numa mudança de `settings.py`.

---

## ADR-12 — Tipos do frontend gerados do OpenAPI
**Status:** Revisado (ver histórico)  ·  **Em uma frase:** Os tipos TypeScript são gerados do schema OpenAPI e nunca editados à mão.

**Contexto.** Com backend e frontend separados, o contrato entre eles pode divergir silenciosamente.

**Decisão.** Os tipos TypeScript são gerados a partir do schema OpenAPI do Ninja (`make types`), e `tsc --noEmit` roda no `make check`. O arquivo `src/api/generated.ts` nunca é editado à mão.

**Por que isso importa.** É o que neutraliza a principal desvantagem do ADR-03. Se alguém renomear um campo num `Schema` do backend e o frontend não acompanhar, `tsc` reprova — em vez de o usuário ver `undefined` em produção. É *mais* segurança de tipos do que a maioria dos projetos SPA com DRF tem na prática.

**A guarda é manual, e isso é uma fragilidade conhecida.** **Não existe CI neste projeto** — não há `.github/workflows/`, e o ADR-16a registra a ausência ao explicar por que o Playwright fica de fora. O que existe é o alvo `check` do `Makefile`, que roda `pytest`, `tsc --noEmit`, os testes do frontend e o build. Ele pega tudo o que um CI pegaria, **quando alguém o roda**. Enquanto for assim, "o build quebra na hora" quer dizer "quebra na máquina de quem rodou o `check`", não "quebra antes do merge".

**Consequências.**
- Positivas: contrato tipado ponta a ponta; refatorações seguras; diferencial técnico real para portfólio.
- Negativas: dois passos a mais no fluxo (`make types`, `make check`), os dois fáceis de esquecer, e nada automático os cobra. O esquecimento falha **aberto**: um `generated.ts` desatualizado não dá sinal nenhum até alguém compilar.

**Quando revisar.** Quando existir CI — aí `make check` vira gatilho de pull request e a fragilidade acima desaparece sem mudar nada desta decisão. É também o momento que o ADR-16a nomeia para reavaliar o Playwright.

**Histórico.** O texto original afirmava que `tsc --noEmit` rodava no CI. Corrigido em 2026-09-23: o CI nunca existiu, e a verificação é o `make check` local.

---

## ADR-13 — Render, Neon e Cloudflare R2
**Status:** Aceito  ·  **Em uma frase:** Render, Neon e R2 no plano gratuito — com o banco deliberadamente fora do Render.

**Decisão.** Versão inicial gratuita: aplicação no Render, banco no Neon, mídia no R2.

**Alternativas consideradas, por componente.**

*Banco no Neon, não no Render.* O Postgres gratuito do Render é deletado 30 dias após a criação, o que o torna inviável para qualquer coisa além de teste. O plano gratuito do Neon é permanente, tem 0,5 GB por projeto — muito acima do necessário, já que só texto e metadados vão para o banco — e escala a zero quando ocioso, com cold start de 0,5 a 2 segundos.

*Supabase descartado.* Projetos gratuitos pausam após sete dias de inatividade e exigem retomada manual. Um clube universitário tem exatamente esse padrão de uso em período de férias. Além disso, o Auth dele seria redundante com o do Django.

*Fly.io descartado apesar da região de São Paulo.* Não há mais tier gratuito para contas novas. A latência de ~120 ms a partir de servidores nos Estados Unidos é irrelevante para este perfil de uso.

**Consequências assumidas.** O serviço gratuito do Render dorme após 15 minutos de inatividade, com cold start de 30 a 60 segundos. É aceitável durante o desenvolvimento e constrangedor após a divulgação ao clube.

**Caminho de upgrade.** O primeiro gasto recomendado é o plano pago do Render (~US$ 7/mês), que elimina o cold start. Banco e storage só depois, por consumo. Estimativa: R$ 0 na versão inicial, ~US$ 7/mês na versão divulgável, ~US$ 15/mês confortável, mais o domínio (~R$ 40/ano).

**A pilha não é só esta.** Somam-se a Sentry (ADR-20) e o provedor de e-mail transacional de que o reset de senha do ADR-05 depende. Nenhum dos dois entra na estimativa acima porque os dois rodam em plano gratuito — mas os dois recebem dado de membro, que é a conta que o ADR-20 manda fazer.

**Quando revisar.** Quando o cold start constranger de verdade, que é o momento do primeiro gasto; se algum dos tiers gratuitos mudar de regra; ou antes de fechar qualquer conta, porque **preços e limites de tier gratuito mudam com frequência e os números acima têm prazo de validade curto**.

---

## ADR-14 — Admin como produto da primeira entrega
**Status:** Aceito  ·  **Em uma frase:** O Admin configurado é a primeira entrega ao usuário, e é o seguro barato contra o único risco real do projeto.

**Contexto.** A escolha do ADR-03 alonga o cronograma. O risco concreto não é técnico: é o clube ficar sem site enquanto a equipe aprende React.

**Decisão.** A primeira etapa do roadmap — modelos e Admin configurado — é tratada como **entrega ao usuário**, não como passo interno. A fundadora recebe acesso ao `/admin/` assim que os modelos existirem.

**Por que funciona como seguro.** O Django Admin não depende de views nem de templates da equipe — ele sobrevive integralmente à escolha do nível 2. Com ele, a fundadora já cadastra livros, elege o Livro do Mês e modera posts. Isso transforma o risco de cronograma em risco de conforto: existe algo funcionando desde a segunda semana, e nenhuma reunião acontece sem nada para mostrar.

**Alternativas consideradas.**

*Tratá-la como passo interno e entregar só quando a SPA existir.* Descartada: é o arranjo que deixa o clube sem nada durante o aprendizado de React, que é exatamente o risco que o ADR-03 criou.

*Construir telas administrativas na SPA.* Descartada por ora, e continua descartada: seria refazer em React o que o Admin já faz, para um único usuário.

**Consequências.**
- Positivas: rede de segurança real; feedback do usuário desde cedo; validação da modelagem antes de investir em interface.
- Negativas: é preciso deixar claro para a fundadora que aquilo é uma etapa, não o produto final — senão a expectativa se ancora numa interface administrativa.

**Consequência que sobrevive ao roadmap.** Configurar o Admin de um modelo novo faz parte de adicionar o modelo, não é tarefa posterior. O Admin é produto, e a fundadora opera o clube por ele — é por isso que há coisas que a SPA nunca ganha tela e não são funcionalidade faltando. É também o que sustenta a exceção de `is_staff` no `/api/docs` (ADR-19).

**Quando revisar.** Se o clube ganhar um segundo operador que não seja da equipe, ou se uma operação recorrente exigir mais passos no Admin do que exigiria numa tela própria. Aí a pergunta é qual operação ganha tela — não se o Admin sai.

---

## ADR-15 — Apps autocontidos, não um app de API central
**Status:** Aceito  ·  **Em uma frase:** Cada app de domínio é dono dos seus schemas e rotas; só as projeções são compartilhadas.

**Contexto.** O ADR-02 escolheu o Django Ninja, mas não disse onde o código da API mora. O guia, na seção 1.2, prescreveu um app `api/` central com `schemas.py` único e um `routers/` por área — uma fachada na frente dos apps de domínio. A alternativa é a que o Django pressupõe e que a documentação do próprio Ninja mostra: cada app expõe o seu pedaço da API.

A pergunta que decide isso não é estética. É onde ficam os *schemas* quando duas entidades fundamentais aparecem juntas na resposta de um endpoint — o que, neste domínio, é a regra e não a exceção: um post traz autor e livro, o perfil traz estante e histórico, a lista de leitores traz membros.

**Decisão.** Cada app de domínio é dono dos seus modelos, schemas e rotas: `books/schemas.py` + `books/api.py`, e assim por diante. O app `api/` deixa de ser fachada e passa a ser **camada compartilhada fina**, com duas responsabilidades apenas:

1. `api/api.py` — a instância `NinjaAPI` e o `add_router` de cada app. Nada mais.
2. `api/schemas.py` — só as **projeções compartilhadas**: `BookOut` e `UserBrief`.

**A distinção que sustenta tudo.** Schemas se dividem em duas categorias, e só uma é compartilhável:

- **Projeções** (`BookOut`, `UserBrief`) — representam uma entidade, não dependem de nenhum outro schema e existem para serem embutidas. Por construção não têm arestas de saída.
- **Formatos de resposta** (`PostOut`, `FinishedReaderOut`, `UserProfileOut`) — representam *o que um endpoint devolve*. Moram com a rota que os devolve, nunca com a entidade que eles citam.

O `FinishedReaderOut` (nascido `ReaderOut`, renomeado quando a rota deixou de responder "quem está lendo") é o exemplo que ensina a regra. Ele mora em `books/schemas.py` **não porque descreva um livro, e sim porque o `picks_router` mora em `books/api.py`** — ele é o retorno de `GET /api/monthly-picks/current/readers`. A pergunta que decide o arquivo é "de quem é a rota", nunca "de quem é a entidade".

**Alternativas consideradas.**

*A fachada `api/` (o que o guia prescrevia).* Descartada. O argumento a favor era real: `BookOut` e `UserBrief` são vocabulário de várias áreas, e centralizar evita pensar em import. Mas o ganho é pequeno — os routers já estavam separados por área, então a fachada centralizava de fato um arquivo só — e o custo cresce: `schemas.py` vira gaveta de tudo, apagar uma feature deixa de ser apagar um diretório, e o app `api/` precisa conhecer todos os domínios. Além disso, contraria a doutrina de apps do Django e a documentação do Ninja, o que cobra um imposto de onboarding em todo desenvolvedor novo.

*Schemas por app sem camada compartilhada.* Descartada, porque não compila. `UserOut.favorites` precisa de `BookOut` e `FinishedReaderOut.user` precisa de `UserBrief`: `users` importaria `books` e `books` importaria `users`. No nível de modelo o Django dissolve isso com referências por string (`"books.Book"`, `settings.AUTH_USER_MODEL`); o Pydantic não tem essa saída, e o ciclo vira `ImportError` de verdade. As projeções existem exatamente para quebrar essa aresta.

*Referências adiantadas (`TYPE_CHECKING` + `model_rebuild()`).* Descartada como arquitetura. O Pydantic 2 permite ciclos assim, mas isso é escotilha de emergência, não planta baixa.

**Estratégia de dependências.** O grafo resultante é acíclico e as arestas são poucas o bastante para caber numa frase cada:

- `books` → projeções. Só `FinishedReaderOut.user` toca terreno de usuário, e toca a projeção, nunca `users.schemas`.
- `posts` → projeções. `PostOut` embute autor e livro; o único contato com outro app é `books.models.Book`, para validar a FK que o `Post` já tem.
- `users` → projeções **e `books`**. É a única importação de schema entre apps de domínio, e é honesta: o histórico do perfil *é* uma lista de leituras mensais, e `User.favorites` já atravessa `books.Favorite` no nível de modelo.

**Regra prática.** Projeção nova só entra em `api/schemas.py` com justificativa, porque cada uma vira vocabulário público. **Não centralize um schema só para evitar um import.**

**Consequências.**
- Positivas: cada app é legível e apagável isoladamente; o layout casa com a doutrina do Django e com a documentação do Ninja; as dependências entre apps ficam visíveis nos imports, em vez de escondidas num arquivo comum; a superfície compartilhada é pequena o bastante (duas classes) para ser revisada de olho.
- Negativas: a divisão entre projeção e formato de resposta é uma disciplina que precisa ser mantida — nada no Python impede alguém de embutir um `UserProfileOut` dentro de outra coisa e reintroduzir um ciclo. E `api/schemas.py`, por conter `BookOut` (um `ModelSchema`), importa `books.models`: a camada compartilhada conhece um domínio. Não é ciclo, mas é o preço de a projeção ser derivada do modelo.

**Corolário: o `operationId` não pode depender do layout.** O padrão do Ninja monta o `operationId` como `<módulo>_<view>`, o que amarra o contrato público à árvore de arquivos: mover uma rota de app renomeia a operação e faz o `generated.ts` do frontend mudar sem que nada da API tenha mudado. Como esta decisão é justamente sobre mover arquivos, o `get_openapi_operation_id` foi sobrescrito para usar **só o nome da view** — `read_me`, `search_books`, `update_reading`. Sem isso, a frase seguinte seria falsa.

O preço é que os nomes de view passam a ser únicos em toda a API, não só dentro do app. Não é combinação a se confiar na memória: `api/test_api.py` falha se dois nomes colidirem ou se um `operationId` voltar a carregar nome de módulo.

**Histórico.** O texto citava `ReaderOut`, nome anterior ao `FinishedReaderOut`, e um diagrama de dependências o arquivava sob a entidade `books` — contra a regra que este próprio ADR estabelece. Nome corrigido e diagrama removido em 2026-09-23.

**Custo de reversão.** Baixo e simétrico. Voltar à fachada é mover quatro arquivos e reunir os schemas; o contrato HTTP e o OpenAPI não mudam em nenhuma das direções — isto é decisão de layout de código, não de API.

**Quando revisar.** Se um app de domínio passar a importar schemas de dois outros, ou se as projeções em `api/schemas.py` passarem de meia dúzia. Qualquer um dos dois indica que a fronteira entre apps parou de corresponder ao domínio.

---

## ADR-16 — Ferramental de desenvolvimento do frontend
**Status:** Revisado (ver histórico do 16b)  ·  **Em uma frase:** Entram o Chrome DevTools MCP e a skill `frontend-design`, com escopo estreito; o Hey API é recusado no mérito.

**Contexto (2026-08-27).** O backend estava fechado e o trabalho de frontend começava — os ADR-18, ADR-19 e ADR-20 voltariam a mexê-lo depois. Três ferramentas foram avaliadas: um MCP de navegador, a skill oficial `frontend-design` da Anthropic, e a troca do `openapi-typescript` pelo Hey API com o plugin de TanStack Query. As duas primeiras mexem só no fluxo de trabalho e são reversíveis apagando uma linha de configuração. A terceira mexe na arquitetura do cliente e contradiz o critério do ADR-03a, então é decisão de arquitetura, não de ferramenta.

**Decisão.** Adotar as duas primeiras, com escopo estreito. Recusar a terceira.

### 16a — Chrome DevTools MCP, em escopo de projeto

Adotado em `.mcp.json` versionado (`claude mcp add --scope project`), não no escopo local: a configuração vale para as duas pessoas do time e entra em revisão de código como qualquer outro arquivo.

Escolhido em vez do Playwright MCP porque o que falta no dia a dia de construir a interface é console, rede e cookies — não navegação cross-browser. O Playwright entra quando existir suíte e2e e CI, que hoje não existem; adotá-lo agora seria configurar ferramenta para um fluxo que ninguém roda.

Duas regras de uso. **Aponte o navegador para o Vite (`:5173`), não para o Django (`:8000`)** — é o caminho que exercita o proxy do ADR-04; abrir `:8000` direto testa um arranjo que não existe nem em dev nem em produção. **A landing do ADR-18 é a única exceção**, porque `/` é a raiz da SPA em `:5173` e por isso o único caminho que não pode ser proxiado: vê-se em `localhost:8000/`, em janela anônima. E **use só contra o ambiente local**: um MCP de navegador transforma conteúdo de página em entrada do agente, e apontar para `/admin/` em produção significa expor dados reais dos membros a essa superfície.

O ganho é específico: as duas armadilhas conhecidas da integração do shell — asset com nome que o Vite não emitiu, escrita recusada por falta do cookie `csrftoken` — são invisíveis no código e imediatas num painel de rede. E o agente autentica sozinho porque o ADR-04 existe: ele preenche o form renderizado de `/accounts/login/` e o cookie de sessão vale pelo resto da execução. Com JWT em `localStorage` seria preciso injetar o token a cada requisição.

### 16b — Skill `frontend-design`, uso único, com a paleta fixada no briefing

**Status:** Revisado pelo ADR-17 — ver **Histórico** ao fim desta subseção.

Adotada para produzir o `frontend/src/styles/tokens.css`, uma vez, no primeiro CSS da SPA. Depois disso não entra no fluxo: o registro dela puxa para o editorial e o ousado, que não é o de um site de clube de leitura universitário.

**A restrição que a torna utilizável: a paleta é fixada no briefing, e vem da marca.** A skill diz que o briefing vence quando ele fixa uma direção. Então o briefing fixa a paleta do `frontend/DESIGN.md` (ADR-17) e gasta a liberdade da skill no que o brandbook não cobre — conceito de layout e elemento assinatura. Escala tipográfica e espaçamento **não** estão nessa lista: o ADR-17 já as registrou como extrapolações no `DESIGN.md`, e valor que nasce no componente é bug de processo.

Isso resolve de passagem um risco que a skill nomeia: entre os três clichês de design gerado por IA que ela manda evitar está "creme quente perto de `#F4F1EA`, serifada de alto contraste, acento terroso". A paleta da marca não é essa.

**Histórico.** Escrito com a premissa de que "a paleta já existe e não está em disputa", apontando para os valores do `auth.css` — `#f6f2ea`, `#1d1a17`, `#7a2e2e`, Inter e uma serifada. A premissa era falsa: a paleta que existia estava no *código*, não na *marca*. O brandbook em `frontend/clubi/` define outra paleta e outra dupla tipográfica, e é anterior a este ADR. **Revisado pelo ADR-17 (2026-08-27)**, que tornou o brandbook a fonte da verdade; os valores antigos estão mortos e não devem ser copiados de commit nenhum. O resto de 16b — uso único, com a paleta fixada no briefing — continua valendo, e com respaldo melhor.

### 16c — Manter o `openapi-typescript` do ADR-12; não adotar o Hey API

O pré-requisito técnico já está satisfeito: o `get_openapi_operation_id` foi sobrescrito no ADR-15 e os `operationId` já são `read_me`, `list_posts`, `update_reading`. Não há custo de migração — nada foi instalado ainda. A recusa é no mérito, por três razões.

1. **Contraria o critério declarado do ADR-03a.** A SPA existe por um motivo explicitamente não-técnico, e o ADR lista o que se quer aprender: "React, TypeScript e **consumo de API**". O Hey API gera justamente a camada de consumo. Alongar o cronograma para aprender a consumir uma API e depois gerar essa camada é pagar o custo do ADR-03 sem receber o benefício pelo qual ele foi aprovado.
2. **O `client.ts` não é boilerplate.** Ele carrega duas regras próprias do projeto: o header `X-CSRFToken` lido do cookie e o 401 → `/accounts/login/?next=…`, que *é* o fluxo de login do ADR-05. Com cliente gerado isso vira configuração de interceptor — possível, mas menos legível para quem está aprendendo, e o invariante "único ponto do frontend que fala com a rede" fica mais difícil de sustentar.
3. **A tabela de `queryKey` escrita à mão é o artefato de ensino, não o problema.** Chaves geradas são objetos por operação, e a regra "invalide todas as chaves que exibem aquele dado" passaria a operar sobre chaves opacas. Para 24 endpoints e uma a duas pessoas, a disciplina manual é mais barata que a indireção.

**O que fica sem cobertura, dito com todas as letras.** O `openapi-typescript` com `tsc --noEmit` pega campo renomeado — que é o risco que o ADR-12 nomeia e o que de fato acontece. Não pega path ou método errado, porque a rota é string literal no `client.ts`. Em dev isso aparece como 404 na primeira renderização, não em produção, e é o preço aceito aqui.

**Consequências.**
- Positivas: o ferramental que entra é reversível e não toca no código de produção; o gerador de tipos continua sendo um passo só; o `client.ts` segue legível de cabo a rabo por quem está aprendendo.
- Negativas: o time carrega à mão uma chamada por endpoint — 24 hoje — e a tabela de invalidação, com a disciplina que isso exige.
- Versionados junto com esta decisão: `.mcp.json`, `.claude/skills/frontend-design/` e `skills-lock.json`. A skill é cópia vendorizada — atualizá-la é rodar o instalador de novo, não editar o arquivo.

**Quando revisar.** O 16c volta à mesa se a API passar de ~40 endpoints, se entrar um segundo consumidor — o app mobile que o ADR-03 prevê —, ou se o time crescer a ponto de a disciplina manual falhar em revisão. Nos três casos o `operationId` já estável torna a adoção barata. O 16a se revisa quando existir CI com e2e, que é quando o Playwright passa a valer. O 16b se revisa se a skill for usada uma segunda vez sem briefing fixando a paleta — sinal de que a costura do ADR-05 voltou a estar em risco.

---

## ADR-17 — Brandbook como fonte da verdade visual
**Status:** Aceito  ·  **Em uma frase:** O brandbook é a fonte da verdade visual, e `frontend/DESIGN.md` é a destilação normativa dele para a web.

**Contexto.** O clube tem identidade visual pronta, produzida antes do site e já em uso nas redes sociais: brandbook de 6 páginas, três variantes de logotipo, duas famílias tipográficas licenciadas, dez elementos gráficos e nove peças aplicadas, tudo em `frontend/clubi/`. O código, enquanto isso, tinha ido para o ar com outra paleta e outra tipografia, improvisadas ao escrever as telas de login, quando ninguém tinha aberto o brandbook. Duas paletas no mesmo produto — e o ADR-16b partiu da que estava no código, escrevendo que ela "não está em disputa". Essa afirmação não sobrevive a abrir o PDF.

**Decisão.** O brandbook é a fonte da verdade visual do projeto. `frontend/DESIGN.md` é a destilação normativa dele para a web e é **leitura obrigatória antes de qualquer trabalho de frontend**. O `auth.css` se realinha aos tokens de lá.

Três regras decorrem:

1. **Rastreabilidade.** Toda cor, fonte, medida e escolha de tom no frontend precisa ser literal do brandbook, derivada dele por fórmula registrada, ou estar na tabela de extrapolações do `DESIGN.md`. Valor que nasce no componente é bug de processo, mesmo que fique bonito.
2. **As extrapolações são explícitas e revisáveis.** A seção 12 do `DESIGN.md` lista, numeradas, as decisões sem respaldo direto — estados de hover, cores de erro/sucesso, escala tipográfica, espaçamento, breakpoints, movimento, e tudo o que as telas seguintes acrescentaram. Eram doze quando este ADR foi escrito e são vinte e uma hoje; a tabela **cresce** a cada tela que pede medida nova, e é assim que deve ser. Elas existem porque a web precisa delas e o brandbook é mídia estática, e ficam separadas para que o fundador possa contestá-las uma a uma.
3. **A costura do ADR-05 continua sendo mitigada por tokens compartilhados.** `styles/tokens.css` e `auth.css` carregam os mesmos valores. A diferença é qual paleta: agora a da marca.

**O que mudou na prática.** As quatro cores da marca entram literais do brandbook (p.3) e os tokens de uso derivam delas:

| Token | Valor | De onde vem |
|---|---|---|
| `--clubi-bg` | `#fdfae7` (creme) | era `#f6f2ea` |
| `--clubi-ink` | `#26161d` | era `#1d1a17`; derivado, não literal — ver E-01 |
| `--clubi-ink-brand`, `--clubi-bg-invert` | `#88013e` (vinho) | não tinha equivalente |
| `--clubi-accent` | `#ed6630` (laranja) | era `#7a2e2e` |
| — | `#ffd071` (amarelo) | não tinha equivalente |
| Tipografia | Clash Display + Manrope, self-hosted | era Inter + uma serifada |

Repare que **o vinho não é o acento**: ele é a tinta de marca e o fundo invertido, e o acento é o laranja. O laranja mede 3.06 sobre creme, por isso `--clubi-accent-ink` existe e é mais escuro que `--clubi-ink`.

O realinhamento do `auth.css` era pré-requisito do primeiro commit de CSS da SPA, não faxina posterior — enquanto os dois lados discordassem, a costura entre `/accounts/` e a SPA ficaria visível, que é o que o ADR-05 aceitou como sua única desvantagem real e prometeu mitigar. **Foi feito**: os tokens saíram do `auth.css` para `backend/core/static/css/tokens.css`, gêmeo declarado de `frontend/src/styles/tokens.css`, e o `auth.css` ficou só com as regras do `.auth-card` (ADR-18).

**Alternativas consideradas.**

- *Manter o `auth.css` e adaptar o brandbook a ele.* Descartada: inverte a hierarquia. A identidade do clube não se ajusta ao que foi improvisado ao escrever as telas de login, e as peças de rede social já estão publicadas com a paleta da marca.
- *Deixar a SPA com a paleta do brandbook e `/accounts/` com a antiga.* Descartada: é a costura do ADR-05 assumida sem mitigação, e num fluxo que todo membro atravessa no primeiro acesso.
- *Não documentar e ir direto ao CSS.* Descartada: é como o `auth.css` surgiu. O brandbook não cobre estado de hover, erro, breakpoint nem escala — sem um documento que registre o que foi derivado e o que foi inventado, a próxima pessoa não distingue marca de improviso e o problema se repete.

**Consequências.**

- Positivas: o site passa a parecer com o clube que já existe no Instagram; some a paleta de origem desconhecida; a skill do 16b recebe um briefing com respaldo real; e a preocupação do 16b com "paleta próxima de um default de IA reconhecível" perde objeto — `#88013e` sobre `#fdfae7` com Clash Display não é o creme-e-serifada genérico. O par vinho/creme mede 9.43:1 e o texto corrido mede 16.47, ambos acima da paleta que substituíram.
- Negativas: `auth.css` precisou de retrabalho antes do primeiro CSS da SPA; entram duas famílias self-hosted onde antes havia fontes de sistema, com custo de banda e de conversão para `woff2`; e o `DESIGN.md` vira mais um documento a manter em dia — um que cresce, porque cada tela nova acrescenta extrapolação.
- Sem tema escuro, e é decisão (E-12): a inversão creme ⇄ vinho já é o modo escuro da marca, e um dark neutro exigiria cores fora do brandbook. Se for pedido, volta como ADR — não como ajuste de token.

**Quando revisar.** Se o brandbook for atualizado — aí o `DESIGN.md` é reescrito a partir dele, nunca o contrário. Ou quando as extrapolações da seção 12 forem revisadas pelo fundador: as aprovadas deixam de ser extrapolação e viram marca, e as recusadas voltam para cá. A E-03 (cores de estado, que exigiram um verde inexistente na marca) é a candidata mais provável a mudar.

---

## ADR-18 — Página de apresentação renderizada em `/`
**Status:** Revisado (ver histórico)  ·  **Em uma frase:** `/` é uma view renderizada porque os robôs de preview de link das redes sociais não executam JavaScript.

**Contexto.** Até aqui o site não tinha porta de entrada. O `/` caía no catch-all, que serve o shell da SPA; a SPA chamava `GET /api/me`, recebia 401 e o `client.ts` mandava o navegador para `/accounts/login/`. Ou seja: **um visitante anônimo era despejado num formulário de senha sem nunca ler uma frase sobre o que é o Clubi.** Isso era tolerável enquanto o site existia para quem já era do clube. Deixa de ser no momento em que o endereço passa a ser divulgado — que é o cenário para o qual esta página nasce.

A pergunta não é se a página deve existir, e sim onde ela mora: uma view Django renderizada, no espírito do ADR-05, ou uma rota pública dentro da SPA.

**Decisão.** Uma view renderizada em `/`, servida pelo Django. `core/views.root` ramifica na sessão: visitante anônimo recebe `templates/landing.html`; membro autenticado recebe o mesmo `index.html` de sempre. **Uma URL, dois documentos, nenhum redirect.**

**O critério que decidiu é o crawler, e só ele.** Os robôs de preview de link do WhatsApp, do Instagram e do Telegram não executam JavaScript: leem os primeiros bytes do HTML e vão embora. A partir do shell da SPA, todo link do Clubi compartilhado em qualquer lugar mostraria para sempre o mesmo card genérico — o `<title>clubi</title>` fixo do `index.html` —, porque o livro do mês só existe depois que o React montou e o `fetch` voltou. Renderizada, a view escreve `og:title`, `og:description` e `og:image` já com o título, o autor e a capa vigentes, no primeiro byte. Numa página cuja função é ser divulgada, isso é a função.

Os outros três critérios avaliados **não** decidiram, e vale registrar por quê, para ninguém reabrir a discussão achando que decidiram:

- *Custo do bundle.* Real, porém secundário. O build pesa 406 KB de JS (130 KB comprimido) mais 31 KB de CSS, e sem esta página o visitante anônimo pagaria tudo isso **e** uma navegação de documento inteira até `/accounts/login/` — desperdício de alguns décimos de segundo, não um argumento estrutural. *O cold start do plano gratuito do Render foi explicitamente descartado como critério*: ele some no plano pago (ADR-13), e esta página nasce para o cenário divulgado.
- *Acesso ao ORM.* Menos decisivo do que parecia na hora, e decisivo de novo desde o ADR-19. A view chama `MonthlyPick.current()` direto, sem round trip e sem estado no cliente. Uma rota na SPA precisaria de um endpoint aberto a anônimo — e a API é fechada por padrão, com `PUBLIC_OPERATIONS` vazia, então abrir um seria a decisão, não o detalhe. Some-se outro custo: o `CurrentUserProvider` envolve o `<Routes>` inteiro e bloqueia a renderização até `/api/me` responder, então uma rota pública exigiria quebrar esse provider em dois — uma reestruturação da raiz da SPA para hospedar uma página sem estado nenhum.
- *Catch-all.* Empate, e é o critério que sai de graça nas duas opções. O `path("", root)` é declarado **antes** do `re_path`, e o Django resolve na ordem: o primeiro padrão que casa vence. O lookahead negativo `^(?!static/|media/|api/|admin/|accounts/).*$` fica **intocado**, o que preserva a propriedade que ele existe para dar — um caminho de API digitado errado devolve 404 em vez de renderizar HTML.

**O fluxo do ADR-05 não muda.** Um deep link para rota autenticada (`/posts`, `/u/ana`) não casa com `path("")`, cai no catch-all e segue o caminho de sempre. Nenhuma linha de `client.ts`, `CurrentUser.tsx` ou `App.tsx` foi tocada, não há endpoint novo, e os CTAs "Entrar" e "Criar conta" apontam para as views que já existiam sob `/accounts/`.

**Alternativas consideradas.**

- *Rota pública dentro da SPA.* Descartada pelo argumento do crawler acima, com o custo do bundle e a quebra do `CurrentUserProvider` como agravantes.
- *Redirecionar o membro autenticado para outra URL* (`/app`, `/home`). Descartada: `/` é a Home na tabela de rotas do guia (7.4) e é o alvo de `LOGIN_REDIRECT_URL`. Mover o app para outro endereço para abrir espaço à apresentação trocaria uma página nova por uma mudança em toda a navegação.
- *Uma URL própria para a apresentação* (`/sobre`, `/apresentacao`), com `/` intacto. Descartada: o endereço que o clube divulga é o domínio raiz. Uma apresentação que só existe um nível abaixo é uma apresentação que quase ninguém abre.
- *Servir a landing a todo mundo e deixar o membro clicar para entrar no app.* Descartada: cobra um clique por visita de quem já é do clube, para mostrar um texto escrito para quem não é.

**Consequências.**

- Positivas: o link do clube ganha preview real, com o livro do mês dentro; o visitante lê antes de ser convidado a se cadastrar; a página é HTML puro, sem JS, e serve de fallback se o bundle quebrar; e nada do ADR-05 precisou ser mexido.
- Negativas, e são três:
  1. **`/` passa a responder dois documentos conforme o cookie.** O `Vary: Cookie` que o `SessionMiddleware` emite é o que impede um cache compartilhado de entregar o shell a um anônimo. Ele sai porque ler `request.user` toca a sessão — o que é uma dependência sutil demais para se confiar, então `core/test_views.py` **asserta o header** em vez de supor.
  2. **A landing não é previsível no dev server do Vite.** A única rota renderizada nova é justamente `/`, que é a raiz da SPA em `:5173` e portanto o único caminho que **não pode** entrar no proxy. Os estáticos dela ficam sob `/static/`, que já está proxiado, então nenhuma entrada nova foi adicionada ao `vite.config.ts`. Vê-se a página em `localhost:8000/`, numa janela anônima.
  3. **Existe agora uma segunda superfície de copy fora do controle da SPA**, com placeholders esperando a fundadora. Texto provisório que ninguém troca vira texto definitivo por omissão.
- Neutra, mas vale saber: o `auth.css` foi partido em dois. Os tokens saíram para `core/static/css/tokens.css`, que a landing e as páginas de `/accounts/` carregam, e o `auth.css` ficou só com as regras do `.auth-card`. O arquivo novo é o gêmeo declarado do `frontend/src/styles/tokens.css` — a mitigação de costura que o ADR-05 prometeu e o ADR-17 reafirmou passa a ser verificável a olho, porque os dois carregam a paleta inteira em vez de um subconjunto.

**Quando revisar.** Se a apresentação passar a precisar de estado (formulário de interesse, área de conteúdo paginada, qualquer coisa que peça interatividade além de links), a conta muda e vale reavaliar se ela é uma tela da SPA — gatilho que o carrossel experimental da E-19 já encosta. E se um dia houver mais de uma página institucional — sobre, contato, edições anteriores abertas ao público —, aí a decisão a tomar não é esta de novo, e sim se o Clubi quer uma camada pública de verdade, com navegação própria, em vez de uma página avulsa.

**Histórico.** Ao pesar o critério "acesso ao ORM", o texto original registrava que `GET /api/monthly-picks/current` era público e usava o fato como argumento. Era descrição, não decisão — e o **ADR-19 (2026-09-11)** fechou a API inteira. O argumento sobrevive por outro caminho, porque a view chama o ORM. Os números de bundle foram remedidos em 2026-09-23, depois do SDK do Sentry (ADR-20).

---

## ADR-19 — API fechada por padrão
**Status:** Aceito  ·  **Em uma frase:** A API é fechada por padrão e pública por exceção nomeada e testada.

**Contexto.** O ADR-04 e o ADR-05 descrevem o **mecanismo** da autenticação. Nenhum dos dois declarava a **política** — quais rotas exigem login —, e o fluxo canônico do ADR-05 induzia a ler a API inteira como fechada. Era falso. A `NinjaAPI` era instanciada sem `auth=` global, então o default de uma rota nova era **público**; e, como o django-ninja marca toda view da API com `csrf_exempt` no middleware e delega a checagem à classe de auth, uma escrita sem `auth=` nascia também **sem proteção CSRF**. A política de fato era a soma de onde alguém lembrou de escrever `auth=django_auth`: dois terços dos GETs respondiam 200 a anônimo.

Entre eles, `GET /api/users/{username}`, que devolve data de nascimento, frase, estante e o histórico completo de leituras — nota e resenha em texto livre — de qualquer membro, por username adivinhável, com `GET /api/users` entregando a lista para adivinhar. Enquanto o site existia para quem já era do clube, isso era teórico. O ADR-18 tornou concreto: ele nasceu para o endereço ser **divulgado**, e com isso colocou perfis de estudantes identificáveis ao alcance de crawlers.

**Decisão.** A API é **fechada por padrão e pública por exceção nomeada e testada**. `auth=django_auth` é declarado uma vez, na instanciação da `NinjaAPI`, e os `add_router` e decorators não repetem mais o que o mount point já diz. As exceções vivem numa constante `PUBLIC_OPERATIONS` em `api/api.py`, cada entrada exigindo comentário que a justifique — e **ela está vazia**.

**Abrir uma rota custa duas edições, de propósito.** `auth=None` na própria rota, que é o que o runtime lê, e a entrada em `PUBLIC_OPERATIONS`, que é o que diz que foi intencional. Nenhuma das duas sozinha faz nada, e `api/test_policy.py` reprova quando discordam: uma operação nomeada na constante que ainda responde 401 falha tão alto quanto uma que responde 200 sem estar nomeada. A superfície pública do Clubi é a landing renderizada do ADR-18, e só ela: a landing lê o livro do mês pelo ORM (`MonthlyPick.current()`), não pela rota, então fechar `/api/monthly-picks` não lhe custa nada.

Isso inclui, explicitamente, perfis, busca de membros, acervo, feed e seleções mensais. Os checks de autoria e de `is_staff` dentro das views (`_own_post`, `_staff_only`) continuam onde estão: são **autorização**, uma pergunta diferente de autenticação, e nenhum auth global responde por eles.

**O perfil é decidido, não pendente**, e a direção é assimétrica: abrir depois é acrescentar um `auth=None` a uma linha; fechar depois de indexado não desfaz o índice, o cache do buscador nem a cópia que alguém guardou.

**Alternativas consideradas.**

- *Manter leitura pública e proteger caso a caso.* É o estado anterior. Ele não falhava nas rotas que existiam — falhava no **default**: nada quebrava quando alguém esquecia o `auth=`, nenhum teste reprovava, e o modo de falha era silencioso e permanente. Uma política que depende de memória não é uma política.
- *Perfil público com os campos sensíveis omitidos.* Descartada por ora. Exigiria decidir consentimento campo a campo — quem opta por expor a estante, quem não expõe a resenha — sem que ninguém tenha pedido a funcionalidade. É desenho de produto disfarçado de ajuste de schema, e o ADR-15 mantém `UserProfileOut` como contrato: mexer nele por um requisito inexistente é custo sem demanda.

**Consequências.**

- Positivas: o default passa a ser o seguro, e o esquecimento agora falha fechado em vez de aberto; toda escrita ganha CSRF por construção, não por convenção (ver ADR-04); a política vira uma linha lida num arquivo só; e `api/test_policy.py` percorre o registro de routers que a `NinjaAPI` de fato serve — não uma lista de caminhos — assertando 401 para toda operação fora de `PUBLIC_OPERATIONS`. Uma rota montada amanhã já nasce coberta.
- Negativas: uma rota que **deva** ser pública agora exige um gesto deliberado — que é o ponto, mas é atrito real para quem vier depois. E o `/api/docs` sai do ar para o público em produção: fora do `DEBUG` ele responde **404 a quem não é `is_staff`**, o que preserva o Swagger para a fundadora (ADR-14) e o tira de todo o resto. A decisão é por requisição e não por `docs_url=None`, porque ler `settings.DEBUG` no import faria o comportamento depender de quando o módulo foi importado — e fazia. `make types` não depende disso, porque o `export_openapi_schema` resolve a instância pela raiz `/api/` e não pela URL do schema.
- Neutra, mas vale saber: o shell da SPA ganhou `<meta name="robots" content="noindex">`. Ele nunca teve conteúdo indexável — deep links como `/u/ana` chegam vazios para um crawler, porque o React só monta depois do `/api/me` —, e agora que esses caminhos respondem 401 o que um robô indexaria seria uma casca. A `landing.html` **não** recebeu a meta: ela existe para ser indexada e compartilhada, que é o ADR-18 inteiro.
- A autorização continua sem varredura equivalente: `_own_post` e `_staff_only` são verificados nos testes dos seus próprios apps, um a um. O que esta decisão torna impossível de esquecer é autenticação, não autorização.

**Quando revisar.** Se a fundadora pedir perfil visível a não-membros. Nesse caso a decisão a tomar **não é esta de novo**: é quais **campos** ficam públicos, um a um. `birth_date` e `review` não são candidatos por default — o primeiro é dado pessoal sem função pública, o segundo é texto escrito para um público conhecido. A pergunta correspondente na seção 10 do guia ("Perfis são públicos ou só para logados?") sai da lista de pendências com esta decisão.

**Histórico.** O texto original nomeava `api/test_api.py` como a varredura de 401; ela mora em `api/test_policy.py`, e o `test_api.py` é o do `operationId` (ADR-15). Corrigido em 2026-09-23, junto com a regra das duas edições e com a exceção de `is_staff` no `/api/docs`.

---

## ADR-20 — Sentry para erros, com o payload decidido antes do DSN
**Status:** Aceito  ·  **Em uma frase:** Sentry só com erros, com o payload restringido nas duas pontas antes de o DSN existir.

**Contexto.** O deploy coloca o site num servidor que ninguém acompanha. Até aqui, um erro era um traceback no terminal de quem estava desenvolvendo; depois do deploy, é um 500 que um membro vê e não reporta. O `DEBUG=False` que o ADR-13 exige é justamente o que apaga a página de erro do Django — correto, e também cego. Não há log persistente: o disco do Render é efêmero (ADR-11) e o `stdout` do serviço rola.

Monitoramento de erro, porém, é uma ferramenta que **exfiltra**: ela existe para mandar o estado do processo para fora, e o estado do processo do Clubi é resenha de estudante, data de nascimento, e-mail e sessão. A pergunta não é "usar Sentry?", é "**o que sai da aplicação?**" — e ela tem que ser respondida antes de o DSN entrar numa variável de ambiente, porque um evento enviado não se desfaz.

Há uma segunda camada: o MCP do Sentry. Ele **não** se conecta à produção — lê o que a aplicação já enviou —, mas o que ele lê passa a fazer parte do contexto da conversa com o agente. Isso não relaxa nada: o dado que não foi enviado é o único que nem o painel nem o agente veem.

**Decisão.** Sentry no plano gratuito, dois projetos (`clubi-backend`, `clubi-frontend`), **só erros**, com o payload restringido nas duas pontas.

*No SDK do Django* (`clubi/settings.py`), quatro opções carregam a decisão e nenhuma é default:

| Opção | O que ela impede |
|---|---|
| `send_default_pii=False` | cookies, IP e identidade do usuário logado em todo evento |
| `include_local_variables=False` | o snapshot de variáveis locais do frame que levantou — numa exceção dentro de `update_reading`, é a resenha do membro |
| `max_request_body_size="never"` | o corpo da requisição: texto de postagem, resenha, frase do perfil |
| `traces_sample_rate=0.0` | amostragem de requisições normais, que é onde a cota gratuita iria embora |

**O snippet oficial do "Get Started" da Sentry contradiz a primeira delas** — ele manda `send_default_pii=True`, com o DSN em código. Aqui o DSN vem de `config("SENTRY_DSN", default="")` e a opção é `False`. Sem DSN o SDK **não inicia**, então máquina de desenvolvimento, `pytest` e CI nunca enviam nada; ativá-lo localmente é exportar a variável no shell, deliberadamente.

*No SDK do navegador* (`main.tsx`): `sendDefaultPii: false`, `<Sentry.ErrorBoundary>` em volta do `<App />` — fora do router e do `QueryClientProvider`, para que ele ainda pegue quando é um deles que quebra — e **Session Replay não entra**. Replay grava a tela do membro, que neste site é resenha sendo digitada e perfil alheio sendo lido.

*Nos source maps*: `sourcemap: "hidden"` e `filesToDeleteAfterUpload` no `@sentry/vite-plugin`. **O apagamento é obrigatório, não higiene:** o Django serve o `dist/` sob `/static/` (ADR-04), então um `.map` que sobrevive ao build é o código-fonte da SPA publicado. O plugin só entra quando existe `SENTRY_AUTH_TOKEN`, e sem token o build **não emite mapa nenhum** — em vez de emitir mapas que ninguém apaga.

*No servidor*, como segunda camada para quando alguém esquecer uma opção no SDK: **Data Scrubber** e **Use Default Scrubbers** ligados, **Prevent Storing of IP Addresses** ligado, e em **Additional Sensitive Fields** os campos do domínio — `birth_date`, `review`, `quote`, `full_name`, `email`. **Essa lista cresce junto com os modelos**, pela mesma lógica do ADR-19: um campo novo de texto livre é um campo novo aqui.

*O MCP* entra em `.mcp.json` versionado, com escopo de organização (`/mcp/clubi-yj`) e não de projeto, porque são dois projetos. A autenticação é OAuth, então o arquivo guarda só a URL e cada pessoa autentica com a própria conta — o mesmo arranjo do ADR-16a. Quem quiser o agente estritamente em leitura usa token pessoal com `org:read`, `project:read`, `event:read` e `?skills=inspect`, com o token no ambiente, nunca no repositório.

**Alternativas consideradas.**

- *Só o `stdout` do Render.* É o que já existe e é o que falha: sem retenção, sem agrupamento, sem stack trace do navegador, e ninguém abre o painel de logs de um site que parece estar no ar.
- *Sentry com os defaults.* Seria uma linha de código em vez de dez. Os três primeiros itens da tabela acima são comportamento padrão que teve que ser desligado: os defaults foram desenhados para depurar rápido.
- *Ligar o tracing desde já.* Descartado por ora. Não há problema de performance conhecido, a cota gratuita é finita, e `traces_sample_rate` é a linha mais fácil de mudar deste ADR inteiro.
- *Rota `/sentry-debug/`.* O "Get Started" a propõe sem ressalva. Ela chegou a existir, fechada sob `DEBUG`, foi usada uma vez para validar esta decisão e **foi descartada em seguida**: sob `DEBUG` o SDK só inicia se alguém exportar um DSN à mão, então no estado normal de qualquer máquina do time ela levanta um erro que não vai a lugar nenhum — não provava o que existia para provar. E em produção uma URL pública que força um 500 é um presente para quem a encontrar, que o lookahead do `urls.py` não esconderia. **A validação, em qualquer ambiente, é um `capture_message` pelo shell** com o DSN exportado só naquele comando.

**Consequências.**

- Positivas: um erro em produção vira um evento com stack trace, ambiente e commit, em vez de um silêncio; o `release` sai do `RENDER_GIT_COMMIT`, então dá para dizer *qual deploy* quebrou; o stack trace do navegador aponta para o TypeScript e não para o bundle; e a decisão sobre dado pessoal está tomada em código, com comentário, em vez de depender de quem configurou o painel.
- Negativas, e são três:
  1. **Depurar fica mais difícil de propósito.** Sem variáveis locais e sem corpo de requisição, sobra o stack trace e o trecho de código. Em troca, nenhum evento carrega o que o membro escreveu. Quem precisar de mais contexto num caso específico adiciona um `set_context` com campos escolhidos a dedo — nunca liga a opção de volta.
  2. **O bundle da SPA cresceu** para 130 kB comprimido (406 kB brutos), cerca de 30 kB a mais. O SDK do navegador não é pequeno, e esta é a primeira dependência de runtime do frontend que não serve ao membro diretamente.
  3. **É mais um serviço de terceiro com dado do clube**, somado ao Render, ao Neon, ao R2 e à Resend. A mitigação é a tabela acima, não a confiança.
- Dois detalhes de build, verificados e não óbvios: o `@sentry/cli` baixa um binário por plataforma como dependência opcional, e o `package-lock.json` traz `cli-linux-x64` junto com o da máquina de desenvolvimento — é o que faz o `npm ci` do Render funcionar sem o `postinstall` que o npm 11 bloqueia por padrão; e o apagamento dos `.map` roda num `finally`, então acontece **mesmo quando o upload falha**. Uma indisponibilidade da Sentry custa os mapas daquele deploy, não o deploy.

**Quando revisar.** Se aparecer um erro que as opções acima tornam indepurável — aí a decisão a tomar não é "ligar tudo de volta", é qual contexto nomeado adicionar àquele ponto do código. Se o tracing passar a valer, o que é sintoma de um problema de performance real e não de curiosidade. E a lista de **Additional Sensitive Fields** se revisa a cada campo de texto livre que entrar nos modelos, sem esperar por um ADR.

