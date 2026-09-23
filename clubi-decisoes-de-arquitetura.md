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
| ADR-12 | Tipos do frontend gerados do OpenAPI | Aceito |
| ADR-13 | Render, Neon e Cloudflare R2 | Aceito |
| ADR-14 | Admin como produto da primeira entrega | Aceito |
| ADR-15 | Apps autocontidos, não um app de API central | Aceito |
| ADR-16 | Ferramental de desenvolvimento do frontend | Revisado (16b) |
| ADR-17 | Brandbook como fonte da verdade visual | Aceito |
| ADR-18 | Página de apresentação renderizada em `/` | Revisado |
| ADR-19 | API fechada por padrão | Aceito |
| ADR-20 | Sentry para erros, com o payload decidido antes do DSN | Aceito |
| ADR-21 | Ler é do clube, escrever é da organização | Aceito |

**Revisado** quer dizer que a decisão continua de pé, mas parte do texto original foi corrigida por um ADR posterior — a correção já está incorporada e o **Histórico** ao fim do ADR diz o que mudou. Um ADR **Aceito** também pode ter **Histórico**: é o caso em que o texto afirmava algo que o código desmentia, sem nenhum ADR envolvido.

---

## ADR-01 — Django como plataforma
**Status:** Aceito  ·  **Em uma frase:** Django porque o clube precisa de Admin, autenticação e upload prontos, não de async.

**Contexto.** O Clubi é um site de clube de leitura com autenticação, perfis, upload de imagens e uma operação editorial recorrente: alguém precisa eleger o Livro do Mês todo mês. A equipe é de uma a duas pessoas, com prazo de semestre.

**Decisão.** Django como framework de backend.

**Alternativas consideradas.**

*FastAPI.* Descartado. O que ele oferece de diferencial — async por padrão, alta concorrência, I/O externo pesado — não é exercido por este projeto. O único I/O externo é a busca na **Open Library**, que um membro dispara ao montar a estante de favoritos do perfil: uma consulta por vez, interativa, com o usuário esperando — exatamente o caso em que async não ajuda. Em contrapartida, seria preciso construir do zero: autenticação completa (hash, sessão ou token, reset de senha com token expirável e e-mail), interface administrativa, tratamento de upload e migrations via Alembic. São semanas de trabalho em código que não é o produto.

*Flask.* Mesma objeção, com menos recursos que o FastAPI.

**Consequências.**
- Positivas: ORM, migrations, autenticação, Admin, gerenciamento de arquivos e sistema de permissões prontos. Ecossistema maduro e documentação em português abundante.
- Negativas: o ORM do Django é difícil de tipar estaticamente; o SQLAlchemy seria superior em consultas complexas. O Clubi é essencialmente CRUD, então essa perda é teórica.

**Quando revisar.** Se surgir um requisito de tempo real (chat, presença ao vivo) com muitas conexões simultâneas, ou se o projeto passar a fazer dezenas de chamadas externas concorrentes por requisição.

---

## ADR-02 — Django Ninja como camada de API
**Status:** Revisado (ver histórico)  ·  **Em uma frase:** Django Ninja dá a ergonomia moderna de API sem abrir mão do ORM e do Admin.

**Contexto.** Escolhido o Django (ADR-01), resta decidir como o backend expõe dados: templates renderizados, Django REST Framework ou Django Ninja.

**Decisão.** Django Ninja, com todos os endpoints sob `/api/`.

**Alternativas consideradas.**

*DRF.* Descartado. O ecossistema dele (viewsets, permissions granulares, throttling, versionamento, filtros) compensa a partir de uma escala de recursos que o Clubi não tem. Com pouco mais de vinte endpoints — 24 hoje —, paga-se a cerimônia sem receber o benefício. Além disso, o DRF não gera documentação OpenAPI sem pacote adicional e não tem suporte a async.

*Templates apenas.* Tecnicamente suficiente e mais rápido de entregar, mas incompatível com ADR-03.

**Consequências.**
- Positivas: schemas Pydantic com validação declarativa, documentação OpenAPI automática em `/api/docs` (em produção restrita a `is_staff`, ver ADR-19), tipagem estática que atravessa até o frontend (ADR-12). Ergonomia próxima à do FastAPI, que atende ao objetivo de aprendizado sem sair do Django.
- Negativas: comunidade menor que a do DRF; menos respostas prontas em fóruns.

**Quando revisar.** Se a API crescer muito e surgirem padrões repetitivos (filtros, permissões por objeto em dezenas de rotas), o DRF passa a ser um ganho real.

**Histórico.** A contagem de endpoints e a disponibilidade do `/api/docs` foram atualizadas em 2026-09-23; a segunda mudou pelo ADR-19 (2026-09-11).

---

## ADR-03 — SPA separada, mesmo repositório
**Status:** Aceito  ·  **Em uma frase:** A API é o caminho principal de dados por um objetivo de aprendizado declarado — e, dado isso, o mono-repo é o arranjo mais simples, não uma concessão.

**Contexto.** Existem três arranjos possíveis: (1) templates renderizados no servidor; (2) SPA e API no mesmo repositório, com deploy coordenado; (3) SPA e API em repositórios e deploys independentes.

Pela análise puramente técnica, o nível 1 seria o indicado: um único consumidor, estado da interface derivável da URL, equipe mínima.

**Decisão.** Nível 2 — `backend/` e `frontend/` no mesmo repositório, um único deploy. São duas decisões encadeadas, com critérios diferentes.

### 3a — Adotar a API como caminho principal de dados (nível 1 → nível 2)

**Critério: não-técnico, declarado.** O objetivo do projeto não é apenas entregar o site: é servir de aprendizado e portfólio para os membros envolvidos. A equipe já domina views e templates Django, de modo que o nível 1 teria aprendizado marginal próximo de zero, enquanto React, TypeScript e consumo de API são exatamente o que uma vaga júnior pede. Esse é um objetivo legítimo — desde que registrado com esse nome, e não disfarçado de necessidade de engenharia.

O nível 1 seria a escolha correta se o critério fosse apenas velocidade de entrega. Nele o Ninja continuaria existindo e sendo usado de fato — favoritos, autocompletes, proxy da Open Library —, apenas com cerca de quatro endpoints em vez de duas dezenas, e com o HTML como caminho principal. A diferença entre os níveis é de proporção, não da existência da API.

É a única decisão do projeto em que um critério não-técnico venceu um argumento técnico contrário. Outros ADRs também respondem a critérios não-técnicos — o ADR-14 a risco de cronograma, o ADR-17 à precedência da marca sobre o código —, mas em nenhum deles havia análise técnica apontando para o outro lado.

### 3b — Um repositório, não dois (nível 2, não nível 3)

**Critério: técnico.** Dada a decisão 3a, o mono-repo é o caminho **mais simples**, não uma concessão. A separação em dois repositórios codifica uma fronteira organizacional — times distintos com ciclos de release independentes. Com uma ou duas pessoas, ela só cobra imposto: PRs pareados, ordem de deploy, tipos duplicados, ambiente local mais complexo, e a impossibilidade de mudar contrato e consumidor no mesmo commit.

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

**A proteção CSRF não vem da mesma origem — vem do `auth=`.** O django-ninja marca toda view da API com `csrf_exempt` no middleware e delega a checagem à classe de auth; hoje ela está ativa em toda escrita porque o `django_auth` é global (ADR-19). Mesma origem é o que torna a sessão utilizável, não o que protege a escrita.

**Quando revisar.** Ao construir um cliente que não seja o navegador na mesma origem.

**Histórico.** O texto original creditava a proteção CSRF à mesma origem e listava quatro caminhos no proxy do Vite. Corrigido em 2026-09-23: o proxy tem cinco, e a proteção depende do `auth=django_auth` que o ADR-19 (2026-09-11) tornou global.

---

## ADR-05 — Autenticação em views renderizadas
**Status:** Aceito  ·  **Em uma frase:** Login, cadastro, logout e reset de senha ficam em views Django renderizadas, porque é a área onde um erro tem consequência de segurança real e o Django já acertou.

**Contexto.** Mesmo com a interface principal em React, o fluxo de autenticação precisa existir: login, cadastro, logout e recuperação de senha.

**Decisão.** Essas telas ficam em views Django renderizadas, sob `/accounts/`. Não há endpoints de autenticação na API.

**O que vem de graça e o que é nosso.** A linha `path("accounts/", include("django.contrib.auth.urls"))` entrega logout e o **fluxo completo de reset de senha** — quatro views, com token assinado, expiração e envio de e-mail. **Login e cadastro são do projeto**: `SignupView` e um `LoginView` com `LoginForm` próprio, registrados antes do `include` para sombreá-lo. É uma divisão deliberada — formulário de login e cadastro são baratos de escrever e queremos os campos e o texto do clube neles; o reset de senha é onde um erro tem consequência de segurança real, e reimplementá-lo custaria cerca de duas semanas em código que não agrega nada ao portfólio.

**Alternativa considerada.** *Telas de autenticação na SPA, com endpoints de auth no Ninja.* Descartada: reescrever pior, em React, o reset de senha que já existe testado — na única área do projeto onde um bug é uma falha de segurança.

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
Uma fonte de verdade, o histórico como subproduto automático, e a média de notas de um livro como agregação simples. Sem negativa relevante.

**Regra de negócio associada.** O registro nasce por `get_or_create` no primeiro clique de progresso. O usuário nunca "entra" no livro do mês explicitamente.

**Nota sobre o nome.** Chama-se `MonthlyReading`, e não `Reading`, porque a tabela **só existe atrelada a um `MonthlyPick`** — nunca a um livro qualquer do acervo. O acesso `user.readings` sugeriria erradamente um histórico de leituras em geral; `user.monthly_readings` diz o que é. Também não é `Review` porque a linha existe desde o primeiro clique de progresso, quando ainda não há nota nem resenha.

**Quando revisar.** Se o clube passar a registrar leituras fora do Livro do Mês — aí `MonthlyReading` deixa de ser o histórico inteiro, e o que se decide é se nasce um `Reading` ao lado ou se este modelo se generaliza.

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

*Adiar a troca para quando fizer falta.* Descartada, e é o ponto inteiro deste ADR, que é de sequenciamento e não de design: trocar o modelo de usuário depois que o banco existe envolve migrations manuais arriscadas. Minutos no início, dias depois.

**Consequências.** Os campos do domínio moram no usuário, sem join, e a porta para qualquer campo futuro já está aberta. Nenhuma negativa relevante — o custo foi pago antes de haver custo.

**Quando revisar.** Não se revisa. A janela em que essa decisão podia ser tomada fechou na primeira migration.

---

## ADR-10 — Autor do livro como texto
**Status:** Aceito  ·  **Em uma frase:** `Book.author` é texto, porque página de autor não é requisito e uma FK traria deduplicação que não se paga.

**Contexto.** Todo livro do acervo tem autor, e a modelagem relacional convencional faria disso uma tabela.

**Decisão.** `Book.author` é `CharField`, não uma FK para um modelo `Author`.

**Alternativas consideradas.**

*FK para um modelo `Author`.* Descartada. Página de autor não é requisito do Clubi, e a FK criaria imediatamente um problema de deduplicação — "Machado de Assis" contra "ASSIS, Machado de" contra "Machado de Assis (1839-1908)" — cujo custo de manutenção não se paga.

**Consequências.**
- Positivas: cadastrar um livro é digitar um campo; não há tabela de autores para manter limpa.
- Negativas: "todos os livros do autor X" não é consulta possível, e grafias divergentes convivem no acervo.

**Quando revisar.** Quando página de autor virar requisito. A migração é direta — criar o modelo, popular a partir dos textos distintos, converter o campo — e é aí que a deduplicação adiada é paga de uma vez.

---

## ADR-11 — Object storage desde o primeiro upload
**Status:** Aceito  ·  **Em uma frase:** Toda mídia vai para o Cloudflare R2 desde o primeiro upload, porque o disco das plataformas de deploy é efêmero.

**Contexto.** O Clubi tem imagens em três lugares: foto de perfil, capa de livro e até quatro imagens por post.

**Decisão.** Toda mídia vai para o Cloudflare R2 via `django-storages`, configurado antes do primeiro upload. Todo upload passa por compressão (redimensionamento para 1600px de largura, JPEG qualidade 82).

**Por que antes do primeiro upload.** O sistema de arquivos das plataformas de deploy usadas é efêmero: toda mídia enviada pelos usuários desapareceria no próximo deploy. Não é otimização, é requisito de correção. A compressão é o que mantém o consumo dentro do plano gratuito e as páginas rápidas.

**Alternativas consideradas.**

*Volume persistente no provedor de hospedagem.* Descartada: prende o projeto a um fornecedor, não tem CDN e sai mais caro.

*Storage local até doer.* Descartada pelo que acontece no meio: a dor aparece depois que a primeira foto de perfil sumiu, e ela não volta.

### 11a — Mídia pública por URL não adivinhável

**Decisão.** A mídia é **pública e sem assinatura**: `querystring_auth=False` mais um `custom_domain`, então todo arquivo responde em `https://media.leiaclubi.com.br/<chave>`, permanentemente e para quem tiver o link. A proteção é a chave não ser adivinhável: `core.storage.RandomKey` devolve `<prefixo>/<uuid4>.jpg` e **descarta o nome do arquivo enviado**.

**Por que sem assinatura.** As imagens vão com `Cache-Control: public, max-age=31536000, immutable`, que é o que mantém o egress baixo e as páginas rápidas. Cache imutável exige **URL estável**, e URL assinada expira — as duas coisas não convivem. Escolhido o cache, a confidencialidade da mídia passa a depender inteiramente da chave.

**Por que UUID e não o nome do arquivo.** O `upload_to="profiles/"` original guardava o nome que o membro tinha no disco, então uma foto enviada como `ana_souza.jpg` publicava `/profiles/ana_souza.jpg` — o nome completo de uma estudante numa URL permanente, e uma chave que qualquer um monta a partir do nome dela. Pior: a chave ficava livre de novo assim que o arquivo era apagado, e o upload seguinte a reusava — com um ano de `immutable`, o cache continuaria servindo a imagem antiga. UUID resolve os dois: não se adivinha e não se repete.

**Consequências.**
- Positivas: mídia sobrevive a deploys; egress gratuito no R2; trocar de provedor é mudar o `settings.py`; e o cache de um ano passa a ser correto por construção, não por convenção.
- Negativas: uma credencial a mais para gerenciar; ambiente local precisa de configuração equivalente (ou storage local em desenvolvimento).
- **Quem tem o link vê a imagem**, e o link não expira. Não há controle de acesso sobre mídia — a foto de perfil de um membro é legível por qualquer um que a tenha, inclusive depois de o perfil ter sido fechado pelo ADR-19. O que o ADR-19 fecha é a rota que *entrega* a URL, não a URL.
- **Apagar um arquivo custa dois passos**: remover o objeto do R2 **e** purgar a URL no cache da Cloudflare. Só o primeiro não basta enquanto o `max-age` de um ano não vencer. **Isso é pendência declarada do fluxo de exclusão de conta**, que ainda não existe.

**Quando revisar.** Se o egress deixar de ser gratuito no R2, ou se o consumo passar o plano gratuito — nos dois casos a decisão é de fornecedor, não de arquitetura, e cabe numa mudança de `settings.py`. E se alguém pedir que a foto de perfil seja visível só a membros: aí a troca é URL assinada contra cache imutável, e é o `Cache-Control` que se revisa primeiro.

---

## ADR-12 — Tipos do frontend gerados do OpenAPI
**Status:** Aceito  ·  **Em uma frase:** Os tipos TypeScript são gerados do schema OpenAPI e nunca editados à mão.

**Contexto.** Com backend e frontend separados, o contrato entre eles pode divergir silenciosamente.

**Decisão.** Os tipos TypeScript são gerados a partir do schema OpenAPI do Ninja (`make types`), e `tsc --noEmit` roda no `make check`. O arquivo `src/api/generated.ts` nunca é editado à mão.

**Por que isso importa.** É o que neutraliza a principal desvantagem do ADR-03. Se alguém renomear um campo num `Schema` do backend e o frontend não acompanhar, `tsc` reprova — em vez de o usuário ver `undefined` em produção. É *mais* segurança de tipos do que a maioria dos projetos SPA com DRF tem na prática.

**A guarda é manual, e isso é uma fragilidade conhecida.** **Não existe CI neste projeto** — não há `.github/workflows/`, e o ADR-16a registra a ausência ao explicar por que o Playwright fica de fora. O que existe é o alvo `check` do `Makefile`, que roda `pytest`, `tsc --noEmit`, os testes do frontend e o build: ele pega tudo o que um CI pegaria, **quando alguém o roda**. "O build quebra na hora" significa "quebra na máquina de quem rodou o `check`", não "antes do merge".

**Consequências.**
- Positivas: contrato tipado ponta a ponta; refatorações seguras; diferencial técnico real para portfólio.
- Negativas: dois passos a mais no fluxo (`make types`, `make check`), os dois fáceis de esquecer, e nada automático os cobra. O esquecimento falha **aberto**: um `generated.ts` desatualizado não dá sinal nenhum até alguém compilar.

**Quando revisar.** Quando existir CI — aí `make check` vira gatilho de pull request e a fragilidade acima desaparece sem mudar nada desta decisão. É também o momento que o ADR-16a nomeia para reavaliar o Playwright.

**Histórico.** O texto original afirmava que `tsc --noEmit` rodava no CI. Corrigido em 2026-09-23: o CI nunca existiu, e a verificação é o `make check` local.

---

## ADR-13 — Render, Neon e Cloudflare R2
**Status:** Aceito  ·  **Em uma frase:** Render, Neon e R2 no plano gratuito — com o banco deliberadamente fora do Render.

**Contexto.** O site é de um clube universitário sem orçamento, e precisa de três coisas hospedadas: o processo Django, um Postgres e a mídia do ADR-11. **O deploy ainda não aconteceu** — esta decisão é a escolha dos provedores, não o relato de um ambiente no ar.

**Decisão.** Versão inicial gratuita: aplicação no Render, banco no Neon, mídia no R2.

**Alternativas consideradas, por componente.**

*Banco no Neon, não no Render.* O Postgres gratuito do Render é deletado 30 dias após a criação, o que o torna inviável para qualquer coisa além de teste. O plano gratuito do Neon é permanente, tem 0,5 GB por projeto — muito acima do necessário, já que só texto e metadados vão para o banco — e escala a zero quando ocioso, com cold start de 0,5 a 2 segundos.

*Supabase descartado.* Projetos gratuitos pausam após sete dias de inatividade e exigem retomada manual. Um clube universitário tem exatamente esse padrão de uso em período de férias. Além disso, o Auth dele seria redundante com o do Django.

*Fly.io descartado apesar da região de São Paulo.* Não há mais tier gratuito para contas novas. A latência de ~120 ms a partir de servidores nos Estados Unidos é irrelevante para este perfil de uso.

**Consequências assumidas.** O serviço gratuito do Render dorme após 15 minutos de inatividade, com cold start de 30 a 60 segundos. É aceitável durante o desenvolvimento e constrangedor após a divulgação ao clube.

**Caminho de upgrade.** O primeiro gasto recomendado é o plano pago do Render (~US$ 7/mês), que elimina o cold start. Banco e storage só depois, por consumo. Estimativa: R$ 0 na versão inicial, ~US$ 7/mês na versão divulgável, ~US$ 15/mês confortável, mais o domínio (~R$ 40/ano).

**A pilha não é só esta.** Somam-se a **Sentry** (ADR-20) e a **Resend**, que entrega o e-mail transacional de que o reset de senha do ADR-05 depende — configurada por SMTP, com as credenciais no ambiente. Nenhuma das duas entra na estimativa acima porque as duas rodam em plano gratuito. As duas recebem dado de membro, e a conta do ADR-20 vale para a Resend também: o que sai para ela é o **e-mail do membro e o link de reset assinado**, montados pelo Django — nada de perfil, resenha ou nota, porque o template de reset do `django.contrib.auth` não os toca.

**Quando revisar.** Quando o cold start constranger de verdade, que é o momento do primeiro gasto; se algum dos tiers gratuitos mudar de regra; ou antes de fechar qualquer conta, porque **preços e limites de tier gratuito mudam com frequência e os números acima têm prazo de validade curto**.

---

## ADR-14 — Admin como produto da primeira entrega
**Status:** Aceito  ·  **Em uma frase:** O Admin configurado é a primeira entrega ao usuário, e é o seguro barato contra o único risco real do projeto.

**Contexto.** A escolha do ADR-03 alonga o cronograma. O risco concreto não é técnico: é o clube ficar sem site enquanto a equipe aprende React.

**Decisão.** A primeira etapa do roadmap — modelos e Admin configurado — é tratada como **entrega ao usuário**, não como passo interno. A fundadora recebe acesso ao `/admin/` assim que os modelos existirem.

**Por que funciona como seguro.** O Django Admin não depende de views nem de templates da equipe — ele sobrevive integralmente à escolha do nível 2. Com ele, a fundadora já cadastra livros, elege o Livro do Mês e modera posts. Isso transforma o risco de cronograma em risco de conforto: existe algo funcionando desde a segunda semana, e nenhuma reunião acontece sem nada para mostrar.

**Alternativas consideradas.**

*Tratá-la como passo interno, entregando só quando a SPA existir.* Descartada: deixa o clube sem nada durante o aprendizado de React, que é o risco criado pelo ADR-03.

*Telas administrativas na SPA.* Descartada: refazer em React o que o Admin já faz, para um único usuário.

**Consequências.**
- Positivas: rede de segurança real; feedback do usuário desde cedo; validação da modelagem antes de investir em interface.
- Negativas: é preciso deixar claro para a fundadora que aquilo é uma etapa, não o produto final — senão a expectativa se ancora numa interface administrativa.

**Corolário permanente.** Configurar o Admin de um modelo novo faz parte de adicionar o modelo. O Admin é produto, e a fundadora opera o clube por ele — é por isso que há coisas que a SPA nunca ganha tela e não são funcionalidade faltando, e é o que sustenta a exceção de `is_staff` no `/api/docs` (ADR-19).

**Quando revisar.** Se o clube ganhar um segundo operador fora da equipe, ou se uma operação recorrente exigir mais passos no Admin do que exigiria numa tela própria. O que se decide aí é qual operação ganha tela, não se o Admin sai.

---

## ADR-15 — Apps autocontidos, não um app de API central
**Status:** Aceito  ·  **Em uma frase:** Cada app de domínio é dono dos seus schemas e rotas; só as projeções são compartilhadas.

**Contexto.** O ADR-02 escolheu o Ninja e não disse onde o código da API mora. O layout inicialmente previsto era um app `api/` central, fachada na frente dos apps de domínio. A pergunta que decide não é estética: é onde ficam os schemas quando duas entidades aparecem juntas na resposta de um endpoint — o que neste domínio é a regra, não a exceção.

**Decisão.** Cada app é dono dos seus modelos, schemas e rotas (`books/schemas.py` + `books/api.py`, e assim por diante). O app `api/` é **camada compartilhada fina**: `api/api.py` guarda a instância `NinjaAPI` e os `add_router`, e `api/schemas.py` guarda só as **projeções** — hoje `BookOut` e `UserBrief`.

**A distinção que sustenta tudo.** Só uma das duas categorias é compartilhável:

- **Projeções** (`BookOut`, `UserBrief`) — representam uma entidade, existem para serem embutidas, e por construção não têm arestas de saída.
- **Formatos de resposta** (`PostOut`, `FinishedReaderOut`, `UserProfileOut`) — representam *o que um endpoint devolve*, e moram com a rota, nunca com a entidade que citam. Herdar de outro formato é normal: `UserOut` reúne o que todo retorno de usuário tem, e `MeOut` e `UserProfileOut` estendem a partir dele.

`FinishedReaderOut` ensina a regra: está em `books/schemas.py` **não porque descreva um livro, e sim porque o `picks_router` está em `books/api.py`**. A pergunta que decide o arquivo é "de quem é a rota". Projeção nova só entra em `api/schemas.py` com justificativa, porque cada uma vira vocabulário público: **não centralize um schema só para evitar um import.**

**Alternativas consideradas.**

- *A fachada `api/` central.* Descartada: centralizaria um arquivo só, e em troca `schemas.py` vira gaveta, apagar uma feature deixa de ser apagar um diretório, o app `api/` conhece todos os domínios, e o layout contraria a doutrina do Django e a documentação do Ninja.
- *Schemas por app sem camada compartilhada.* Descartada porque **não compila**: `UserOut.favorites` (em `users`) precisa de `BookOut`, e `FinishedReaderOut.user` (em `books`) precisa de `UserBrief` — os dois apps se importariam mutuamente. O Django dissolve isso nos modelos com referências por string; o Pydantic não, e o ciclo vira `ImportError`.
- *`TYPE_CHECKING` + `model_rebuild()`.* Descartada como arquitetura: é escotilha de emergência, não planta baixa.

**As arestas que sobram** são acíclicas: `books` e `posts` importam só projeções; `users` importa projeções **e `books.schemas`**, a única entre apps de domínio — e honesta, porque o histórico do perfil *é* uma lista de leituras mensais.

**Corolário: o `operationId` não pode depender do layout.** O padrão do Ninja é `<módulo>_<view>`, que amarraria o contrato público à árvore de arquivos — mover uma rota mudaria o `generated.ts` sem que a API mudasse. Como esta decisão é sobre mover arquivos, `get_openapi_operation_id` usa **só o nome da view**. Preço: nomes de view são únicos em toda a API, e `api/test_api.py` reprova se dois colidirem.

**Consequências.**
- Positivas: cada app é legível e apagável isoladamente; as dependências ficam visíveis nos imports em vez de escondidas num arquivo comum; a superfície compartilhada são duas classes.
- Negativas: a divisão projeção/formato é disciplina — nada no Python impede embutir um `UserProfileOut` em outra coisa e reintroduzir o ciclo. E `api/schemas.py` importa `books.models` por causa de `BookOut`: a camada compartilhada conhece um domínio. Não é ciclo, é o preço de a projeção derivar do modelo.
- Reversão barata e simétrica: voltar à fachada é mover arquivos, e o contrato HTTP não muda em nenhuma direção.

**Quando revisar.** Se um app passar a importar schemas de dois outros, ou se as projeções passarem de meia dúzia. Qualquer um dos dois indica que a fronteira entre apps parou de corresponder ao domínio.

**Histórico.** O texto citava `ReaderOut`, nome anterior ao `FinishedReaderOut`, e um diagrama de dependências o arquivava sob a entidade `books`, contra a regra deste próprio ADR. Corrigido e o diagrama removido em 2026-09-23.

---

## ADR-16 — Ferramental de desenvolvimento do frontend
**Status:** Revisado (ver histórico do 16b)  ·  **Em uma frase:** Entram o Chrome DevTools MCP e a skill `frontend-design`, com escopo estreito; o Hey API é recusado no mérito.

**Contexto (2026-08-27).** O backend estava fechado e o trabalho de frontend começava. Três ferramentas foram avaliadas: um MCP de navegador, a skill oficial `frontend-design` da Anthropic, e a troca do `openapi-typescript` pelo Hey API com o plugin de TanStack Query. As duas primeiras mexem só no fluxo de trabalho e são reversíveis apagando uma linha de configuração; a terceira mexe na arquitetura do cliente e contradiz o critério do ADR-03a, então é decisão de arquitetura, não de ferramenta.

**Decisão.** Adotar as duas primeiras, com escopo estreito. Recusar a terceira.

### 16a — Chrome DevTools MCP, em escopo de projeto

Adotado em `.mcp.json` versionado (`--scope project`), não no escopo local: a configuração vale para as duas pessoas do time e entra em revisão de código como qualquer arquivo. Escolhido em vez do Playwright MCP porque o que falta no dia a dia de construir a interface é console, rede e cookies — não navegação cross-browser. O Playwright entra quando existir suíte e2e e CI, que hoje não existem (ADR-12).

Duas regras de uso. **Aponte o navegador para o Vite (`:5173`), não para o Django (`:8000`)** — é o caminho que exercita o proxy do ADR-04, e abrir `:8000` direto testa um arranjo que não existe nem em dev nem em produção; **a landing do ADR-18 é a única exceção**, porque `/` é a raiz da SPA em `:5173` e não pode ser proxiada. E **use só contra o ambiente local**: um MCP de navegador transforma conteúdo de página em entrada do agente, e apontar para `/admin/` em produção expõe dados reais dos membros a essa superfície.

O ganho é específico: as duas armadilhas conhecidas da integração do shell — asset com nome que o Vite não emitiu, escrita recusada por falta do cookie `csrftoken` — são invisíveis no código e imediatas num painel de rede. E o agente autentica sozinho porque o ADR-04 existe: preenche o form de `/accounts/login/` e o cookie vale pelo resto da execução. Com JWT em `localStorage` seria preciso injetar o token a cada requisição.

### 16b — Skill `frontend-design`, uso único, com a paleta fixada no briefing

**Status:** Revisado pelo ADR-17 — ver **Histórico** ao fim desta subseção.

Adotada para produzir o `frontend/src/styles/tokens.css`, uma vez, no primeiro CSS da SPA. Depois disso não entra no fluxo: o registro dela puxa para o editorial e o ousado, que não é o de um site de clube de leitura universitário.

**A restrição que a torna utilizável: a paleta é fixada no briefing, e vem da marca.** A skill diz que o briefing vence quando fixa uma direção, então o briefing fixa a paleta do `DESIGN.md` (ADR-17) e gasta a liberdade dela no que o brandbook não cobre — conceito de layout e elemento assinatura. Escala tipográfica e espaçamento **não** estão nessa lista: o ADR-17 já as registrou como extrapolações. Isso resolve em parte um risco que a skill nomeia: um dos três clichês de design gerado por IA que ela manda evitar é "creme quente perto de `#F4F1EA`, serifada de alto contraste, acento terroso". O creme da marca (`#fdfae7`) **cai nessa descrição** e não vai mudar por isso — ele vem do brandbook. As outras duas metades não: Clash Display não é serifada de alto contraste, e `#ed6630` não é acento terroso.

**Histórico.** Escrito com a premissa de que "a paleta já existe e não está em disputa", apontando para os valores do `auth.css` — `#f6f2ea`, `#1d1a17`, `#7a2e2e`, Inter e uma serifada. A premissa era falsa: a paleta que existia estava no *código*, não na *marca*, e o brandbook é anterior a este ADR. **Revisado pelo ADR-17 (2026-08-27)**; os valores antigos estão mortos e não devem ser copiados de commit nenhum. O resto de 16b continua valendo, e com respaldo melhor.

### 16c — Manter o `openapi-typescript` do ADR-12; não adotar o Hey API

O pré-requisito técnico já estava satisfeito — o `operationId` ficou estável no ADR-15 — e não havia custo de migração, porque nada tinha sido instalado. A recusa é no mérito, por três razões.

1. **Contraria o critério declarado do ADR-03a.** A SPA existe para aprender "React, TypeScript e **consumo de API**", e o Hey API gera justamente a camada de consumo: seria pagar o custo do ADR-03 sem receber o benefício pelo qual ele foi aprovado.
2. **O `client.ts` não é boilerplate.** Ele carrega duas regras do projeto — o `X-CSRFToken` lido do cookie e o 401 → `/accounts/login/?next=…`, que *é* o fluxo do ADR-05. Com cliente gerado isso vira interceptor: possível, porém menos legível para quem aprende, e o invariante "único ponto do frontend que fala com a rede" fica mais difícil de sustentar.
3. **A tabela de `queryKey` escrita à mão é o artefato de ensino, não o problema.** Chaves geradas são objetos por operação, e a regra "invalide todas as chaves que exibem aquele dado" passaria a operar sobre chaves opacas. Para 24 endpoints e uma a duas pessoas, a disciplina manual é mais barata que a indireção.

**O que fica sem cobertura, dito com todas as letras.** O `openapi-typescript` com `tsc --noEmit` pega campo renomeado, que é o risco do ADR-12 e o que de fato acontece. **Não pega path nem método errado**, porque a rota é string literal no `client.ts`. Em dev isso aparece como 404 na primeira renderização, e é o preço aceito.

**Consequências.**
- Positivas: o ferramental que entra é reversível e não toca no código de produção; o gerador de tipos continua sendo um passo só; o `client.ts` segue legível de cabo a rabo por quem está aprendendo.
- Negativas: o time carrega à mão uma chamada por endpoint — 24 hoje — e a tabela de invalidação, com a disciplina que isso exige.
- Versionados junto com esta decisão: `.mcp.json`, `.claude/skills/frontend-design/` e `skills-lock.json`. A skill é cópia vendorizada — atualizá-la é rodar o instalador de novo, não editar o arquivo.

**Quando revisar.** O **16c** volta à mesa se a API passar de ~40 endpoints, se entrar um segundo consumidor (o app mobile que o ADR-03 prevê), ou se o time crescer a ponto de a disciplina manual falhar em revisão — nos três casos o `operationId` estável torna a adoção barata. O **16a**, quando existir CI com e2e. O **16b**, se a skill for usada uma segunda vez sem briefing fixando a paleta, sinal de que a costura do ADR-05 voltou a estar em risco.

---

## ADR-17 — Brandbook como fonte da verdade visual
**Status:** Aceito  ·  **Em uma frase:** O brandbook é a fonte da verdade visual, e `frontend/DESIGN.md` é a destilação normativa dele para a web.

**Contexto.** O clube tem identidade visual pronta, anterior ao site e já em uso nas redes sociais: brandbook de 6 páginas, três variantes de logotipo, duas famílias licenciadas, dez elementos gráficos e nove peças aplicadas, em `frontend/clubi/`. O código, enquanto isso, tinha ido para o ar com outra paleta e outra tipografia, improvisadas ao escrever as telas de login, quando ninguém tinha aberto o brandbook. Duas paletas no mesmo produto — e o ADR-16b partiu da que estava no código, escrevendo que ela "não está em disputa". Essa afirmação não sobrevive a abrir o PDF.

**Decisão.** O brandbook é a fonte da verdade visual, e `frontend/DESIGN.md` é a destilação normativa dele para a web — **leitura obrigatória antes de qualquer trabalho de frontend**. Três regras decorrem:

1. **Rastreabilidade.** Toda cor, fonte, medida e escolha de tom precisa ser literal do brandbook, derivada dele por fórmula registrada, ou estar na tabela de extrapolações do `DESIGN.md`. Valor que nasce no componente é bug de processo, mesmo que fique bonito.
2. **As extrapolações são explícitas e revisáveis.** A seção 12 do `DESIGN.md` numera tudo que não tem respaldo direto — hover, cores de estado, escala tipográfica, espaçamento, breakpoints, movimento. Eram doze quando este ADR foi escrito e são vinte e uma hoje: a tabela **cresce** a cada tela que pede medida nova. Ficam separadas para a fundadora contestá-las uma a uma.
3. **Os tokens vivem em dois arquivos gêmeos**, `backend/core/static/css/tokens.css` e `frontend/src/styles/tokens.css` — a mitigação que o ADR-05 prometeu para a costura entre `/accounts/` e a SPA. Mudar um sem o outro reabre a costura.

**O que mudou na prática.** As quatro cores da marca entram literais do brandbook (p.3) e os tokens de uso derivam delas:

| Token | Valor | Antes |
|---|---|---|
| `--clubi-bg` | `#fdfae7` (creme) | `#f6f2ea` |
| `--clubi-ink` | `#26161d` | `#1d1a17`; derivado, não literal (E-01) |
| `--clubi-ink-brand`, `--clubi-bg-invert` | `#88013e` (vinho) | não existia |
| `--clubi-accent` | `#ed6630` (laranja) | `#7a2e2e` |
| — | `#ffd071` (amarelo) | não existia |
| Tipografia | Clash Display + Manrope, self-hosted | Inter + uma serifada |

**O vinho não é o acento**: ele é a tinta de marca e o fundo invertido; o acento é o laranja, que mede 3.06 sobre creme — por isso existe `--clubi-accent-ink` (`#290013`), mais escuro que `--clubi-ink` de propósito. O realinhamento do `auth.css` era pré-requisito do primeiro CSS da SPA, e **foi feito** (ADR-18).

**Alternativas consideradas.**

- *Adaptar o brandbook ao `auth.css`.* Descartada: inverte a hierarquia, e as peças de rede social já estão publicadas com a paleta da marca.
- *SPA com a paleta nova, `/accounts/` com a antiga.* Descartada: é a costura do ADR-05 assumida sem mitigação, num fluxo que todo membro atravessa no primeiro acesso.
- *Não documentar e ir direto ao CSS.* Descartada: é como o `auth.css` surgiu. Sem registrar o que foi derivado e o que foi inventado, a próxima pessoa não distingue marca de improviso e o problema se repete.

**Consequências.**
- Positivas: o site passa a parecer com o clube que já existe no Instagram, e some a paleta de origem desconhecida. A preocupação do 16b com "paleta próxima de um default de IA" fica sem objeto no que ela decidia — a paleta agora é da marca, não uma preferência, e não há acento a revisar. Os contrastes também melhoram: vinho/creme mede 9.43, texto corrido 16.47.
- Negativas: `auth.css` precisou de retrabalho; entram duas famílias self-hosted onde antes havia fontes de sistema, com custo de banda e de conversão para `woff2`; e o `DESIGN.md` vira mais um documento a manter em dia — um que cresce a cada tela.
- Sem tema escuro, e é decisão (E-12): a inversão creme ⇄ vinho já é o modo escuro da marca, e um dark neutro exigiria cores fora do brandbook. Se for pedido, volta como ADR.

**Quando revisar.** Se o brandbook for atualizado — aí o `DESIGN.md` é reescrito a partir dele, nunca o contrário. Ou quando a fundadora revisar as extrapolações: as aprovadas viram marca, as recusadas voltam para cá. A E-03 (cores de estado, que exigiram um verde inexistente na marca) é a candidata mais provável.

---

## ADR-18 — Página de apresentação renderizada em `/`
**Status:** Revisado (ver histórico)  ·  **Em uma frase:** `/` é uma view renderizada porque os robôs de preview de link das redes sociais não executam JavaScript.

**Contexto.** O site não tinha porta de entrada: `/` caía no catch-all, servia o shell da SPA, e o 401 do `/api/me` mandava o navegador para `/accounts/login/`. **Um visitante anônimo era despejado num formulário de senha sem nunca ler uma frase sobre o que é o Clubi** — tolerável enquanto o site existia para quem já era do clube, e insustentável a partir do momento em que o endereço passa a ser divulgado, que é o cenário para o qual esta página nasce. A pergunta não era se a página deve existir, e sim onde ela mora: view Django renderizada, no espírito do ADR-05, ou rota pública dentro da SPA.

**Decisão.** Uma view renderizada em `/`, servida pelo Django. `core/views.root` ramifica na sessão: anônimo recebe `templates/landing.html`, membro autenticado recebe o `index.html` de sempre. **Uma URL, dois documentos, nenhum redirect.**

**O critério que decidiu é o crawler, e só ele.** Os robôs de preview do WhatsApp, do Instagram e do Telegram não executam JavaScript: leem os primeiros bytes do HTML e vão embora. A partir do shell da SPA, todo link do Clubi compartilhado em qualquer lugar mostraria para sempre o mesmo card genérico — o `<title>clubi</title>` fixo do `index.html` —, porque o livro do mês só existe depois que o React montou. Renderizada, a view escreve `og:title`, `og:description` e `og:image` com o título, o autor e a capa vigentes, no primeiro byte. Numa página cuja função é ser divulgada, isso é a função.

Os outros três critérios avaliados **não** decidiram, e vale registrar para ninguém reabrir a discussão achando que decidiram:

- *Custo do bundle.* Real, porém secundário — 406 kB de JS (130 kB comprimido) mais 31 kB de CSS, alguns décimos de segundo. *O cold start do plano gratuito do Render foi explicitamente descartado como critério*: ele some no plano pago (ADR-13).
- *Acesso ao ORM.* Menos decisivo do que parecia: a view chama `MonthlyPick.current()` direto, mas uma rota na SPA também teria como buscar o dado. O que pesava de verdade era outro custo — o `CurrentUserProvider` envolve o `<Routes>` inteiro e bloqueia a renderização até `/api/me` responder, então uma rota pública exigiria quebrá-lo em dois para hospedar uma página sem estado nenhum. (O ADR-19 encareceu a alternativa depois: com a API fechada por padrão, a rota da SPA exigiria abrir um endpoint a anônimo, que seria a decisão em vez do detalhe.)
- *Catch-all.* Empate, e sai de graça nas duas opções. `path("", root)` é declarado **antes** do `re_path` e o Django resolve na ordem, então o lookahead negativo fica **intocado** — um caminho de API digitado errado continua devolvendo 404 em vez de HTML.

**O fluxo do ADR-05 não muda.** Um deep link para rota autenticada não casa com `path("")`, cai no catch-all e segue o caminho de sempre. Nenhuma linha de `client.ts`, `CurrentUser.tsx` ou `App.tsx` foi tocada, não há endpoint novo, e os CTAs apontam para as views que já existiam sob `/accounts/`.

**Alternativas consideradas.**

- *Rota pública dentro da SPA.* Descartada pelo argumento do crawler, com o custo do bundle e a quebra do provider como agravantes.
- *Redirecionar o membro autenticado para `/app` ou `/home`.* Descartada: `/` é a Home da SPA e o alvo de `LOGIN_REDIRECT_URL`; mover o app para abrir espaço trocaria uma página nova por uma mudança em toda a navegação.
- *Uma URL própria (`/sobre`), com `/` intacto.* Descartada: o endereço que o clube divulga é o domínio raiz, e uma apresentação um nível abaixo é uma que quase ninguém abre.
- *Servir a landing a todo mundo.* Descartada: cobra um clique por visita de quem já é do clube, para mostrar um texto escrito para quem não é.

**Consequências.**
- Positivas: o link do clube ganha preview real, com o livro do mês dentro; o visitante lê antes de ser convidado a se cadastrar; a página é HTML puro e serve de fallback se o bundle quebrar; e nada do ADR-05 precisou ser mexido.
- Negativas, e são três. **(1)** `/` passa a responder dois documentos conforme o cookie, e o que impede um cache compartilhado de entregar o shell a um anônimo é o `Vary: Cookie` do `SessionMiddleware` — uma dependência sutil demais para se confiar, então `core/test_views.py` **asserta o header**. **(2)** A landing não é visível no dev server do Vite: `/` é a raiz da SPA em `:5173` e por isso o único caminho que não pode ser proxiado — vê-se em `localhost:8000/`, em janela anônima. **(3)** Existe agora uma segunda superfície de copy fora da SPA, com placeholders esperando a fundadora, e texto provisório que ninguém troca vira definitivo por omissão.
- Neutra: o `auth.css` foi partido em dois, e os tokens saíram para `core/static/css/tokens.css`. Como ele passou a carregar a paleta inteira em vez do subconjunto que o `auth.css` tinha, a regra dos gêmeos (ADR-17) ficou verificável a olho.

**Quando revisar.** Se a apresentação passar a precisar de estado — formulário de interesse, conteúdo paginado, qualquer interatividade além de links —, a conta muda e vale reavaliar se ela é uma tela da SPA; é o gatilho que o carrossel experimental da E-19 já encosta. E se um dia houver mais de uma página institucional, a decisão a tomar não é esta de novo: é se o Clubi quer uma camada pública de verdade, com navegação própria.

**Histórico.** Ao pesar o critério "acesso ao ORM", o texto original registrava que `GET /api/monthly-picks/current` era público e usava o fato como argumento. Era descrição, não decisão — e o **ADR-19 (2026-09-11)** fechou a API inteira; o argumento sobrevive porque a view chama o ORM. Números de bundle remedidos em 2026-09-23, depois do SDK do Sentry.

---

## ADR-19 — API fechada por padrão
**Status:** Aceito  ·  **Em uma frase:** A API é fechada por padrão e pública por exceção nomeada e testada.

**Contexto.** O ADR-04 e o ADR-05 descrevem o **mecanismo** da autenticação; nenhum declarava a **política** — quais rotas exigem login. A `NinjaAPI` era instanciada sem `auth=` global, então o default de uma rota nova era **público** — e, pelo mecanismo que o ADR-04 descreve, uma escrita sem `auth=` nascia também **sem proteção CSRF**. A política de fato era a soma de onde alguém lembrou de escrever `auth=django_auth`: dois terços dos GETs respondiam 200 a anônimo.

Entre eles, `GET /api/users/{username}`, que devolve data de nascimento, frase, estante e o histórico completo de leituras — nota e resenha em texto livre — de qualquer membro, por username adivinhável, com `GET /api/users` entregando a lista para adivinhar. Era teórico enquanto o site existia para quem já era do clube. O ADR-18 tornou concreto: ele nasceu para o endereço ser **divulgado**, e com isso colocou perfis de estudantes identificáveis ao alcance de crawlers.

**Decisão.** A API é **fechada por padrão e pública por exceção nomeada e testada**. `auth=django_auth` é declarado uma vez, na instanciação da `NinjaAPI`, e os `add_router` e decorators não repetem o que o mount point já diz. As exceções vivem em `PUBLIC_OPERATIONS`, em `api/api.py`, cada entrada exigindo comentário que a justifique — e **ela está vazia**. Isso inclui perfis, busca de membros, acervo, feed e seleções mensais: a superfície pública do Clubi é a landing do ADR-18, que lê o livro do mês pelo ORM e não pela rota.

**Abrir uma rota custa duas edições, de propósito:** `auth=None` na rota, que é o que o runtime lê, e a entrada na constante, que é o que diz que foi intencional. Nenhuma sozinha faz nada, e `api/test_policy.py` reprova quando discordam.

**O perfil é decidido, não pendente**, e a direção é assimétrica: abrir depois é acrescentar `auth=None` a uma linha; fechar depois de indexado não desfaz o índice, o cache do buscador nem a cópia que alguém guardou.

**Alternativas consideradas.**

- *Manter leitura pública e proteger caso a caso.* É o estado anterior, e não falhava nas rotas que existiam — falhava no **default**: nada quebrava quando alguém esquecia o `auth=`, nenhum teste reprovava, e o modo de falha era silencioso e permanente. Uma política que depende de memória não é uma política.
- *Perfil público com os campos sensíveis omitidos.* Descartada por ora: exigiria decidir consentimento campo a campo sem que ninguém tenha pedido a funcionalidade. É desenho de produto disfarçado de ajuste de schema.

**Consequências.**
- Positivas: o default passa a ser o seguro e o esquecimento falha fechado; toda escrita ganha CSRF por construção (ADR-04); a política vira uma linha lida num arquivo só; e `api/test_policy.py` percorre o registro de routers que a `NinjaAPI` de fato serve — não uma lista de caminhos — assertando 401 para toda operação fora da constante, então uma rota montada amanhã já nasce coberta.
- Negativas: uma rota que **deva** ser pública exige um gesto deliberado, que é o ponto mas é atrito. E o `/api/docs` responde **404 a quem não é `is_staff`** fora do `DEBUG`, preservando o Swagger para a fundadora (ADR-14) e tirando-o do resto; decidido por requisição e não por `docs_url=None`, porque ler `settings.DEBUG` no import faz o comportamento depender de quando o módulo foi importado — e fazia. `make types` não depende disso.
- A **autorização continua sem varredura equivalente**: `_own_post` e `_staff_only` são verificados nos testes dos seus próprios apps, um a um. Esta decisão torna impossível esquecer autenticação, não autorização.
- Neutra: o shell da SPA ganhou `<meta name="robots" content="noindex">`, porque esses caminhos agora respondem 401 e o que um robô indexaria seria uma casca. A `landing.html` **não** recebeu a meta — ela existe para ser indexada, que é o ADR-18 inteiro.

**Quando revisar.** Se a fundadora pedir perfil visível a não-membros. Aí a decisão **não é esta de novo**: é quais **campos** ficam públicos, um a um. `birth_date` e `review` não são candidatos por default — o primeiro é dado pessoal sem função pública, o segundo é texto escrito para um público conhecido.

**Histórico.** O texto original nomeava `api/test_api.py` como a varredura de 401; ela mora em `api/test_policy.py`, e o `test_api.py` é o do `operationId` (ADR-15). Corrigido em 2026-09-23, junto com a regra das duas edições e a exceção de `is_staff` no `/api/docs`.

---

## ADR-20 — Sentry para erros, com o payload decidido antes do DSN
**Status:** Aceito  ·  **Em uma frase:** Sentry só com erros, com o payload restringido nas duas pontas antes de o DSN existir.

**Contexto.** O deploy, que ainda não aconteceu (ADR-13), coloca o site num servidor que ninguém acompanha. Até aqui um erro era um traceback no terminal de quem estava desenvolvendo; depois do deploy, é um 500 que um membro vê e não reporta. O `DEBUG=False` que o ADR-13 exige é justamente o que apaga a página de erro do Django — correto, e também cego —, e não há log persistente: o disco do Render é efêmero (ADR-11) e o `stdout` do serviço rola.

Monitoramento de erro, porém, é uma ferramenta que **exfiltra**: existe para mandar o estado do processo para fora, e o estado do processo do Clubi é resenha de estudante, data de nascimento, e-mail e sessão. A pergunta não é "usar Sentry?", é "**o que sai da aplicação?**" — e ela tem que ser respondida antes de o DSN entrar numa variável de ambiente, porque um evento enviado não se desfaz. Vale para o MCP do Sentry também: ele não toca a produção, lê o que a aplicação já enviou — e o dado que não foi enviado é o único que nem o painel nem o agente veem.

**Decisão.** Sentry no plano gratuito, dois projetos (`clubi-backend`, `clubi-frontend`), **só erros**, com o payload restringido nas duas pontas.

*No SDK do Django* (`clubi/settings.py`), quatro opções carregam a decisão e nenhuma é default:

| Opção | O que ela impede |
|---|---|
| `send_default_pii=False` | cookies, IP e identidade do usuário logado em todo evento |
| `include_local_variables=False` | o snapshot de variáveis locais do frame que levantou — numa exceção dentro de `update_reading`, é a resenha do membro |
| `max_request_body_size="never"` | o corpo da requisição: texto de postagem, resenha, frase do perfil |
| `traces_sample_rate=0.0` | amostragem de requisições normais, que é onde a cota gratuita iria embora |

**O snippet oficial do "Get Started" da Sentry contradiz a primeira delas** — ele manda `send_default_pii=True`, com o DSN em código. Aqui o DSN vem de `config("SENTRY_DSN", default="")` e a opção é `False`. Sem DSN o SDK **não inicia**, então máquina de desenvolvimento e `pytest` nunca enviam nada; ativá-lo localmente é exportar a variável no shell, deliberadamente.

*No SDK do navegador* (`main.tsx`): `sendDefaultPii: false`, `<Sentry.ErrorBoundary>` em volta do `<App />` — fora do router e do `QueryClientProvider`, para que ele pegue quando é um deles que quebra — e **Session Replay não entra**, porque Replay grava a tela do membro, que neste site é resenha sendo digitada e perfil alheio sendo lido.

*Nos source maps*: `sourcemap: "hidden"` e `filesToDeleteAfterUpload` no `@sentry/vite-plugin`. **O apagamento é obrigatório, não higiene:** o Django serve o `dist/` sob `/static/` (ADR-04), então um `.map` que sobrevive ao build é o código-fonte da SPA publicado. O plugin só entra quando existe `SENTRY_AUTH_TOKEN`, e sem token o build **não emite mapa nenhum** — em vez de emitir mapas que ninguém apaga.

*No servidor*, como segunda camada para quando alguém esquecer uma opção no SDK: **Data Scrubber**, **Use Default Scrubbers** e **Prevent Storing of IP Addresses** ligados, e em **Additional Sensitive Fields** os campos do domínio — `birth_date`, `review`, `quote`, `full_name`, `email`. **Essa lista cresce junto com os modelos**: um campo novo de texto livre é um campo novo aqui.

*O MCP* entra em `.mcp.json` versionado, com escopo de organização e não de projeto, porque são dois projetos. A autenticação é OAuth, então o arquivo guarda só a URL e cada pessoa autentica com a própria conta — o mesmo arranjo do ADR-16a. Quem quiser o agente estritamente em leitura usa token pessoal com `org:read`, `project:read`, `event:read` e `?skills=inspect`, com o token no ambiente, nunca no repositório.

**Alternativas consideradas.**

- *Só o `stdout` do Render.* É o que já existe e é o que falha: sem retenção, sem agrupamento, sem stack trace do navegador, e ninguém abre o painel de logs de um site que parece estar no ar.
- *Sentry com os defaults.* Seria uma linha de código em vez de dez, e os três primeiros itens da tabela acima são comportamento padrão que teve que ser desligado: os defaults foram desenhados para depurar rápido.
- *Ligar o tracing desde já.* Descartado por ora: não há problema de performance conhecido, a cota gratuita é finita, e `traces_sample_rate` é a linha mais fácil de mudar deste ADR inteiro.
- *Rota `/sentry-debug/`, que o "Get Started" propõe sem ressalva.* Chegou a existir, fechada sob `DEBUG`, foi usada uma vez para validar esta decisão e **foi descartada em seguida**: sob `DEBUG` o SDK só inicia se alguém exportar um DSN à mão, então no estado normal de qualquer máquina do time ela levanta um erro que não vai a lugar nenhum — não provava o que existia para provar. E em produção uma URL pública que força um 500 é um presente para quem a encontrar. **A validação, em qualquer ambiente, é um `capture_message` pelo shell** com o DSN exportado só naquele comando.

**Consequências.**
- Positivas: um erro em produção vira um evento com stack trace, ambiente e commit em vez de um silêncio; o `release` sai do `RENDER_GIT_COMMIT`, então dá para dizer *qual deploy* quebrou; o stack trace do navegador aponta para o TypeScript e não para o bundle; e a decisão sobre dado pessoal está tomada em código, com comentário, em vez de depender de quem configurou o painel.
- Negativas, e são três. **(1) Depurar fica mais difícil de propósito**: sem variáveis locais e sem corpo de requisição, sobra o stack trace e o trecho de código — em troca, nenhum evento carrega o que o membro escreveu. Quem precisar de mais contexto num caso específico adiciona um `set_context` com campos escolhidos a dedo, **nunca liga a opção de volta**. **(2)** O bundle da SPA cresceu para 130 kB comprimido (406 kB brutos), cerca de 30 kB a mais, e esta é a primeira dependência de runtime do frontend que não serve ao membro diretamente. **(3)** É mais um serviço de terceiro com dado do clube, somado ao Render, ao Neon, ao R2 e ao provedor de e-mail — e a mitigação é a tabela acima, não a confiança.
- Dois detalhes de build, verificados e não óbvios: o `@sentry/cli` baixa um binário por plataforma como dependência opcional, e o `package-lock.json` traz `cli-linux-x64` junto com o da máquina de desenvolvimento — é o que faz o `npm ci` do Render funcionar sem o `postinstall` que o npm 11 bloqueia por padrão; e o apagamento dos `.map` roda num `finally`, então acontece **mesmo quando o upload falha**. Uma indisponibilidade da Sentry custa os mapas daquele deploy, não o deploy.

**Quando revisar.** Se aparecer um erro que as opções acima tornam indepurável — aí a decisão a tomar não é "ligar tudo de volta", é qual contexto nomeado adicionar àquele ponto do código. Se o tracing passar a valer, o que é sintoma de um problema de performance real e não de curiosidade. E a lista de **Additional Sensitive Fields** se revisa a cada campo de texto livre que entrar nos modelos, sem esperar por um ADR.

---

## ADR-21 — Ler é do clube, escrever é da organização
**Status:** Aceito  ·  **Em uma frase:** Todo membro lê o feed; só `is_staff` publica, edita e apaga postagem — e o que é do próprio membro só ele mexe.

**Contexto.** O ADR-19 fechou a API a quem não é membro, e disse com todas as letras que resolve **autenticação**, não **autorização**: uma vez logado, todo mundo é igual para o `auth=django_auth`. Falta declarar quem pode o quê dentro do clube. A regra existia no código desde as primeiras postagens e nunca tinha sido escrita aqui.

**Decisão.** Duas perguntas diferentes, dois mecanismos.

**Postagem é voz da organização.** Criar, editar, apagar uma postagem e anexar imagem a ela são `is_staff`-only, recusados com **403 em pt-BR** (`_staff_only` em `posts/api.py`). Leitura do feed é de todo membro. O clube tem uma voz institucional, e o feed é ela — não é rede social interna. Esconder o botão "Postar" de quem não é staff é cortesia da interface; **a checagem no backend é a regra**, e `GET /api/me` é a única resposta que carrega `is_staff`, justamente para a SPA saber o que desenhar.

**O que é do membro só o membro mexe.** Progresso, nota, resenha, estante e perfil são escritos pelo dono e por mais ninguém — as rotas os alcançam por `request.user`, nunca por um id vindo do cliente, o que torna a regra estrutural em vez de uma checagem que alguém pode esquecer. Onde o id vem do cliente, a checagem é explícita (`_own_post`).

**Alternativas consideradas.**

- *Permissões do Django por objeto, ou um pacote de regras.* Descartada: são duas regras, e um framework de permissões custa mais para ler do que as duas funções que elas viraram.
- *Deixar qualquer membro postar, moderando depois.* Descartada: o feed é a voz do clube, e moderação é trabalho recorrente que ninguém se ofereceu para fazer.

**Consequências.**
- Positivas: a regra cabe em duas funções nomeadas; `is_staff` já vem do Django e já é o que dá acesso ao Admin (ADR-14), então não há segundo conceito de "organização" para manter.
- Negativas, e é a mesma que o ADR-19 aponta: **não há varredura automática de autorização**. `api/test_policy.py` garante que toda rota exige login, mas quem esquecer o `_staff_only` numa escrita nova a deixa aberta a qualquer membro logado, e só o teste do próprio app pega. É o gatilho de revisão abaixo.
- `is_staff` dá o Admin inteiro junto. Não existe "pode postar mas não entra no Admin", e isso é aceito porque hoje as duas pessoas são as mesmas.

**Quando revisar.** Se surgir alguém que deva publicar sem receber o Admin — aí nasce um papel de verdade, e `is_staff` deixa de servir. Ou se as escritas `is_staff`-only passarem de meia dúzia, quando vale dar à autorização a mesma varredura que o ADR-19 deu à autenticação.
