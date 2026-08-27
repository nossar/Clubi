# Clubi — Decisões de arquitetura

Registro das decisões estruturais do projeto, com o contexto que as motivou, as alternativas descartadas e as consequências assumidas. O objetivo é que daqui a seis meses — ou quando entrar alguém novo — ninguém precise reconstruir o raciocínio do zero.

Formato: cada decisão traz **contexto**, **decisão**, **alternativas consideradas**, **consequências** (boas e ruins) e **quando revisar**.

**Índice**

| | Decisão |
|---|---|
| ADR-01 | Django como plataforma |
| ADR-02 | Django Ninja como camada de API |
| ADR-03 | SPA separada, mesmo repositório |
| ADR-04 | Mesma origem, sessão e CSRF |
| ADR-05 | Autenticação em views renderizadas |
| ADR-06 | Livro do Mês como entidade própria |
| ADR-07 | `MonthlyReading` unifica progresso e histórico |
| ADR-08 | Listas de tamanho fixo como tabelas com `position` |
| ADR-09 | Modelo de usuário customizado desde o dia 1 |
| ADR-10 | Autor do livro como texto |
| ADR-11 | Object storage desde o primeiro upload |
| ADR-12 | Tipos do frontend gerados do OpenAPI |
| ADR-13 | Render + Neon + R2 |
| ADR-14 | Admin como produto da primeira entrega |

---

## ADR-01 — Django como plataforma

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

**Contexto.** Escolhido o Django (ADR-01), resta decidir como o backend expõe dados: templates renderizados, Django REST Framework ou Django Ninja.

Vale registrar que **DRF e Ninja não são alternativas ao Django** — rodam dentro dele, sobre o mesmo ORM, Admin e autenticação. A escolha é de camada, não de plataforma.

**Decisão.** Django Ninja, com todos os endpoints sob `/api/`.

**Alternativas consideradas.**

*DRF.* Descartado. O ecossistema dele (viewsets, permissions granulares, throttling, versionamento, filtros) compensa a partir de uma escala de recursos que o Clubi não tem. Com cerca de vinte endpoints, paga-se a cerimônia sem receber o benefício. Além disso, o DRF não gera documentação OpenAPI sem pacote adicional e não tem suporte a async.

*Templates apenas.* Tecnicamente suficiente e mais rápido de entregar, mas incompatível com ADR-03.

**Consequências.**
- Positivas: schemas Pydantic com validação declarativa, documentação OpenAPI automática em `/api/docs`, tipagem estática que atravessa até o frontend (ADR-12). Ergonomia próxima à do FastAPI, que atende ao objetivo de aprendizado sem sair do Django.
- Negativas: comunidade menor que a do DRF; menos respostas prontas em fóruns.

**Quando revisar.** Se a API crescer muito e surgirem padrões repetitivos (filtros, permissões por objeto em dezenas de rotas), o DRF passa a ser um ganho real.

**Onde esse código mora** é assunto do ADR-15.

---

## ADR-03 — SPA separada, mesmo repositório

**Contexto.** Existem três arranjos possíveis: (1) templates renderizados no servidor; (2) SPA e API no mesmo repositório, com deploy coordenado; (3) SPA e API em repositórios e deploys independentes.

Pela análise puramente técnica, o nível 1 seria o indicado: um único consumidor, estado da interface derivável da URL, equipe mínima. **Esta decisão foi tomada por um critério declarado e não-técnico.**

**Decisão.** Nível 2 — `backend/` e `frontend/` no mesmo repositório, um único deploy.

São, na verdade, **duas decisões encadeadas com critérios diferentes**, e confundi-las gera leitura errada. Vale separá-las.

### 3a — Adotar a API como caminho principal de dados (nível 1 → nível 2)

**Critério: não-técnico, declarado.** O objetivo do projeto não é apenas entregar o site: é servir de aprendizado e portfólio para os membros envolvidos. A equipe já domina views e templates Django, de modo que o nível 1 teria aprendizado marginal próximo de zero, enquanto React, TypeScript e consumo de API são exatamente o que uma vaga júnior pede. Esse é um objetivo legítimo — desde que registrado com esse nome, e não disfarçado de necessidade de engenharia.

O nível 1 seria a escolha correta se o critério fosse apenas velocidade de entrega. Nele o Ninja continuaria existindo e sendo usado de fato — favoritos, autocompletes, proxy da API de livros —, apenas com cerca de quatro endpoints em vez de vinte, e com o HTML como caminho principal. A diferença entre os níveis é de proporção, não da existência da API.

**Esta é a única decisão do projeto tomada por critério não-técnico.**

### 3b — Um repositório, não dois (nível 2, não nível 3)

**Critério: técnico.** Dada a decisão 3a, o mono-repo é o caminho **mais simples**, não uma concessão. A separação em dois repositórios codifica uma fronteira organizacional — times distintos com ciclos de release independentes. Com uma ou duas pessoas, ela só cobra imposto: PRs pareados, ordem de deploy, tipos duplicados, ambiente local mais complexo, e a impossibilidade de mudar contrato e consumidor no mesmo commit.

Importante: nos níveis 2 e 3 **a API é consumida de forma idêntica em runtime**. O mesmo `fetch`, o mesmo JSON. A diferença é inteiramente de build, deploy e organização.

O mono-repo é também o que viabiliza as decisões ADR-04 (mesma origem, sem CORS nem JWT) e ADR-12 (tipos gerados sem publicar pacote). Ou seja: ele não apenas não cria as dores do nível 3 — ele é a precondição para eliminá-las.

**Consequências.**
- Positivas: aprendizado alinhado ao mercado; separação real de responsabilidades; a API já nasce pronta para um eventual app mobile.
- Negativas: perde-se os Django Forms (o formset das 4 imagens vira upload manual pela API) e a renderização server-side. Surge estado duplicado entre banco e cliente, com a classe de problemas de cache que isso implica. O cronograma alonga.
- Mitigação do risco de cronograma: ver ADR-14.

**Quando revisar.** Se o projeto atrasar a ponto de ameaçar a entrega ao clube, a fase de fallback é o Admin (ADR-14), não uma volta ao nível 1.

---

## ADR-04 — Mesma origem, autenticação por sessão

**Contexto.** Escolhido o nível 2, é preciso decidir como a SPA se autentica na API.

**Decisão.** Frontend e backend respondem na **mesma origem**. A SPA usa o cookie de sessão do Django e envia o header `X-CSRFToken`. Em desenvolvimento, o Vite faz proxy de `/api`, `/admin`, `/contas` e `/media` para o Django; em produção, o Django serve o `index.html` do build.

**Alternativas consideradas.**

*Origens distintas com JWT.* É o arranjo default de tutoriais e foi descartado deliberadamente. Ele traz uma cadeia inteira de problemas — CORS, escolha entre `localStorage` (vulnerável a XSS) e cookie, refresh token, revogação, expiração — que **existe apenas porque as origens foram separadas**. Nenhum desses problemas é do domínio do Clubi.

**Consequências.**
- Positivas: zero configuração de CORS; proteção CSRF do Django continua ativa; `request.user` funciona nos endpoints exatamente como funcionaria numa view; logout é imediato e real.
- Negativas: um app mobile nativo futuro não pode usar sessão e precisaria de um esquema de token adicional. É um problema aditivo, não bloqueante.

**Quando revisar.** Ao construir um cliente que não seja o navegador na mesma origem.

---

## ADR-05 — Autenticação em views renderizadas

**Contexto.** Mesmo com a interface principal em React, o fluxo de autenticação precisa existir: login, cadastro, logout e recuperação de senha.

**Decisão.** Essas telas ficam em views Django renderizadas, sob `/contas/`. Não há endpoints de autenticação na API.

**Justificativa.** A linha `path("contas/", include("django.contrib.auth.urls"))` entrega seis views prontas, incluindo o fluxo completo de reset de senha com token assinado, expiração e envio de e-mail. Reimplementar isso em React consumiria cerca de duas semanas em código que não agrega nada ao portfólio — e é justamente a área onde um erro tem consequência de segurança real.

**Consequências.**
- Positivas: segurança testada por padrão; economia grande de tempo; a fronteira é limpa e fácil de justificar.
- Negativas: uma descontinuidade visual entre as páginas de login e a SPA. Mitigável usando os mesmos tokens de CSS nos dois lados.

**Fluxo definido.** Usuário anônimo abre a SPA → `/api/me` responde 401 → o cliente redireciona para `/contas/entrar/?next=…` → após autenticar, volta com sessão válida.

---

## ADR-06 — Livro do Mês como entidade própria

**Contexto.** O sketch original modelava o Livro do Mês como um booleano `isLivroDoMes` no próprio `Book`.

**Decisão.** Criar `MonthlyPick`, com FK para `Book`, `month` única e período de vigência. O booleano não existe.

**Justificativa.** Com o booleano, eleger o livro de novembro exige desmarcar o de outubro — e nesse instante a informação de que outubro existiu desaparece. O histórico de avaliações no perfil, que é requisito, se torna impossível de reconstruir. Além disso, o booleano impede que o mesmo livro seja escolhido novamente anos depois, e não tem onde guardar dados que são do clube e não do livro: período de leitura, justificativa da escolha, data da discussão.

**Consequências.**
- Positivas: histórico preservado por construção; releitura possível; `on_delete=PROTECT` impede que apagar um livro destrua o histórico de todos.
- Negativas: uma consulta a mais para descobrir o livro vigente. Encapsulada em `MonthlyPick.current()`.

---

## ADR-07 — `MonthlyReading` unifica progresso e histórico

**Contexto.** O sketch listava, como campos separados do usuário, "progresso/avaliação (livro do mês)" e "histórico de avaliações dos livros do mês".

**Decisão.** Um único modelo `MonthlyReading`, com unicidade em `(user, pick)`.

**Justificativa.** São o mesmo registro observado em momentos diferentes. O progresso atual é o `MonthlyReading` cuja seleção está vigente; o histórico é o conjunto de todas elas. Mantê-los separados criaria duplicação de verdade e um bug previsível: na virada do mês, o progresso anterior seria sobrescrito.

**Consequências.**
- Positivas: uma fonte de verdade; o histórico é subproduto automático; a média de notas de um livro é uma agregação simples.
- Negativas: nenhuma relevante.

**Regra de negócio associada.** O registro nasce por `get_or_create` no primeiro clique de progresso. O usuário nunca "entra" no livro do mês explicitamente.

**Nota sobre o nome.** Chama-se `MonthlyReading`, e não `Reading`, porque a tabela **só existe atrelada a um `MonthlyPick`** — nunca a um livro qualquer do acervo. O acesso `user.readings` sugeriria erradamente um histórico de leituras em geral; `user.monthly_readings` diz o que é. Também não é `Review` porque a linha existe desde o primeiro clique de progresso, quando ainda não há nota nem resenha.

---

## ADR-08 — Listas de tamanho fixo como tabelas com `position`

**Contexto.** O sketch previa `Livros (favoritos apenas)[4]` no usuário e `images[4]` no post.

**Decisão.** Modelos intermediários `Favorite` e `PostImage`, ambos com campo `position` e `CheckConstraint` limitando a 1–4.

**Justificativa.** Banco relacional não armazena arrays de chave estrangeira de forma satisfatória, e em ambos os casos a ordem importa: qual favorito aparece primeiro na estante, qual imagem é a capa do post.

**Consequências.**
- Positivas: ordenação explícita; unicidade de slot garantida no banco; fácil evoluir o limite de 4 para outro valor.
- Negativas: uma tabela a mais para cada lista.

**Decisão de API relacionada.** A estante é salva por substituição atômica (`PUT /api/me/favoritos` com os quatro itens), não por endpoints de adicionar, remover e reordenar. Reordenação é a operação mais comum e seria a mais desajeitada no modelo incremental.

---

## ADR-09 — Modelo de usuário customizado desde o dia 1

**Contexto.** O Clubi precisa de campos que o usuário padrão do Django não tem: nome completo, data de nascimento, foto e quote.

**Decisão.** `User(AbstractUser)` com `AUTH_USER_MODEL` definido **antes da primeira migration**.

**Justificativa.** Não é uma decisão de design, é de sequenciamento. Trocar o modelo de usuário depois que o banco existe é notoriamente doloroso no Django e envolve migrations manuais arriscadas. O custo de fazer certo no início é de minutos; o de corrigir depois, de dias.

**Alternativa considerada.** `Profile` com relação um-para-um com o `User` padrão. Descartada: adiciona um join em praticamente toda consulta e a possibilidade de perfil ausente.

---

## ADR-10 — Autor do livro como texto

**Decisão.** `Book.author` é `CharField`, não uma FK para um modelo `Author`.

**Justificativa.** Página de autor não é requisito do Clubi. Uma FK criaria imediatamente um problema de deduplicação — "Machado de Assis" contra "ASSIS, Machado de" contra "Machado de Assis (1839-1908)" — cujo custo de manutenção não se paga.

**Consequências.** Se um dia quiserem "todos os livros do autor X", a migração é direta: criar o modelo, popular a partir dos textos distintos e converter o campo.

---

## ADR-11 — Object storage desde o primeiro upload

**Contexto.** O Clubi tem imagens em três lugares: foto de perfil, capa de livro e até quatro imagens por post.

**Decisão.** Toda mídia vai para o Cloudflare R2 via `django-storages`, configurado antes do primeiro upload. Todo upload passa por compressão (redimensionamento para 1600px de largura, JPEG qualidade 82).

**Justificativa.** O sistema de arquivos das plataformas de deploy usadas é efêmero: toda mídia enviada pelos usuários desapareceria no próximo deploy. Não é otimização, é requisito de correção. A compressão é o que mantém o consumo dentro do plano gratuito e as páginas rápidas.

**Alternativa considerada.** Volume persistente no provedor de hospedagem. Descartada: prende o projeto a um fornecedor, não tem CDN e sai mais caro.

**Consequências.**
- Positivas: mídia sobrevive a deploys; egress gratuito no R2; trocar de provedor é mudar o `settings.py`.
- Negativas: uma credencial a mais para gerenciar; ambiente local precisa de configuração equivalente (ou storage local em desenvolvimento).

---

## ADR-12 — Tipos do frontend gerados do OpenAPI

**Contexto.** Com backend e frontend separados, o contrato entre eles pode divergir silenciosamente.

**Decisão.** Os tipos TypeScript são gerados a partir do schema OpenAPI do Ninja (`make tipos`), e `tsc --noEmit` roda no CI. O arquivo `src/api/gen.ts` nunca é editado à mão.

**Justificativa.** É o que neutraliza a principal desvantagem do ADR-03. Se alguém renomear um campo num `Schema` do backend e o frontend não acompanhar, o build quebra na hora — em vez de o usuário ver `undefined` em produção. Vale notar que isso é *mais* segurança de tipos do que a maioria dos projetos SPA com DRF tem na prática.

**Consequências.**
- Positivas: contrato tipado ponta a ponta; refatorações seguras; diferencial técnico real para portfólio.
- Negativas: um passo a mais no fluxo de trabalho, que é esquecido com facilidade. Por isso está no `Makefile` e no CI.

---

## ADR-13 — Render, Neon e Cloudflare R2

**Decisão.** Versão inicial gratuita: aplicação no Render, banco no Neon, mídia no R2.

**Justificativa por componente.**

*Banco no Neon, não no Render.* O Postgres gratuito do Render é deletado 30 dias após a criação, o que o torna inviável para qualquer coisa além de teste. O plano gratuito do Neon é permanente, tem 0,5 GB por projeto — muito acima do necessário, já que só texto e metadados vão para o banco — e escala a zero quando ocioso, com cold start de 0,5 a 2 segundos.

*Supabase descartado.* Projetos gratuitos pausam após sete dias de inatividade e exigem retomada manual. Um clube universitário tem exatamente esse padrão de uso em período de férias. Além disso, o Auth dele seria redundante com o do Django.

*Fly.io descartado apesar da região de São Paulo.* Não há mais tier gratuito para contas novas. A latência de ~120 ms a partir de servidores nos Estados Unidos é irrelevante para este perfil de uso.

**Consequências assumidas.** O serviço gratuito do Render dorme após 15 minutos de inatividade, com cold start de 30 a 60 segundos. É aceitável durante o desenvolvimento e constrangedor após a divulgação ao clube.

**Caminho de upgrade.** O primeiro gasto recomendado é o plano pago do Render (~US$ 7/mês), que elimina o cold start. Banco e storage só depois, por consumo. Estimativa: R$ 0 na versão inicial, ~US$ 7/mês na versão divulgável, ~US$ 15/mês confortável, mais o domínio (~R$ 40/ano).

**Observação.** Preços e limites de tier gratuito mudam com frequência. Confirme antes de fechar as contas.

---

## ADR-14 — Admin como produto da primeira entrega

**Contexto.** A escolha do ADR-03 alonga o cronograma. O risco concreto não é técnico: é o clube ficar sem site enquanto a equipe aprende React.

**Decisão.** A Fase 1 do roadmap (modelos e Admin configurado) é tratada como **entrega ao usuário**, não como etapa interna. A fundadora recebe acesso ao `/admin/` assim que os modelos existirem.

**Justificativa.** O Django Admin não depende de views nem de templates da equipe — ele sobrevive integralmente à escolha do nível 2. Com ele, a fundadora já cadastra livros, elege o Livro do Mês e modera posts. Isso transforma o risco de cronograma em risco de conforto: existe algo funcionando desde a segunda semana, e nenhuma reunião acontece sem nada para mostrar.

**Consequências.**
- Positivas: rede de segurança real; feedback do usuário desde cedo; validação da modelagem antes de investir em interface.
- Negativas: é preciso deixar claro para a fundadora que aquilo é uma etapa, não o produto final — senão a expectativa se ancora numa interface administrativa.

---

## ADR-15 — Apps autocontidos, não um app de API central

**Contexto.** O ADR-02 escolheu o Django Ninja, mas não disse onde o código da API mora. O guia, na seção 1.2, prescreveu um app `api/` central com `schemas.py` único e um `routers/` por área — uma fachada na frente dos apps de domínio. A alternativa é a que o Django pressupõe e que a documentação do próprio Ninja mostra: cada app expõe o seu pedaço da API.

A pergunta que decide isso não é estética. É onde ficam os *schemas* quando duas entidades fundamentais aparecem juntas na resposta de um endpoint — o que, neste domínio, é a regra e não a exceção: um post traz autor e livro, o perfil traz estante e histórico, a lista de leitores traz membros.

**Decisão.** Cada app de domínio é dono dos seus modelos, schemas e rotas: `books/schemas.py` + `books/api.py`, e assim por diante. O app `api/` deixa de ser fachada e passa a ser **camada compartilhada fina**, com duas responsabilidades apenas:

1. `api/api.py` — a instância `NinjaAPI` e o `add_router` de cada app. Nada mais.
2. `api/schemas.py` — só as **projeções compartilhadas**: `BookOut` e `UserBrief`.

**A distinção que sustenta tudo.** Schemas se dividem em duas categorias, e só uma é compartilhável:

- **Projeções** (`BookOut`, `UserBrief`) — representam uma entidade, não dependem de nenhum outro schema e existem para serem embutidas. Por construção não têm arestas de saída.
- **Formatos de resposta** (`PostOut`, `ReaderOut`, `UserProfileOut`) — representam *o que um endpoint devolve*. Moram com a rota que os devolve, nunca com a entidade que eles citam.

O `ReaderOut` é o exemplo que ensina a regra: ele não é um schema de "books", é o retorno de `GET /api/monthly-picks/current/readers`. Arquivá-lo sob a entidade errada é o que cria ciclo; arquivá-lo sob a rota resolve.

**Alternativas consideradas.**

*A fachada `api/` (o que o guia prescrevia).* Descartada. O argumento a favor era real: `BookOut` e `UserBrief` são vocabulário de várias áreas, e centralizar evita pensar em import. Mas o ganho é pequeno — os routers já estavam separados por área, então a fachada centralizava de fato um arquivo só — e o custo cresce: `schemas.py` vira gaveta de tudo, apagar uma feature deixa de ser apagar um diretório, e o app `api/` precisa conhecer todos os domínios. Além disso, contraria a doutrina de apps do Django e a documentação do Ninja, o que cobra um imposto de onboarding em todo desenvolvedor novo.

*Schemas por app sem camada compartilhada.* Descartada, porque não compila. `UserOut.favorites` precisa de `BookOut` e `ReaderOut.user` precisa de `UserBrief`: `users` importaria `books` e `books` importaria `users`. No nível de modelo o Django dissolve isso com referências por string (`"books.Book"`, `settings.AUTH_USER_MODEL`); o Pydantic não tem essa saída, e o ciclo vira `ImportError` de verdade. As projeções existem exatamente para quebrar essa aresta.

*Referências adiantadas (`TYPE_CHECKING` + `model_rebuild()`).* Descartada como arquitetura. O Pydantic 2 permite ciclos assim, mas isso torna o ciclo possível, não bom. É escotilha de emergência, não planta baixa.

**Estratégia de dependências.** O grafo resultante é acíclico e as arestas são poucas o bastante para caber numa frase cada:

```
        api/schemas  (BookOut, UserBrief)
           ↑     ↑     ↑
        books  posts   │
           ↑           │
         users ────────┘
```

- `books` → projeções. Só `ReaderOut.user` toca terreno de usuário, e toca a projeção, nunca `users.schemas`.
- `posts` → projeções. `PostOut` embute autor e livro; o único contato com outro app é `books.models.Book`, para validar a FK que o `Post` já tem.
- `users` → projeções **e `books`**. É a única importação de schema entre apps de domínio, e é honesta: o histórico do perfil *é* uma lista de leituras mensais, e `User.favorites` já atravessa `books.Favorite` no nível de modelo.

Repare que o grafo de schemas fica **melhor que o de modelos**: no nível de modelo `users` e `books` se referenciam mutuamente, e no nível de schema a dependência é estritamente `users → books`. A projeção quebrou a aresta de volta.

**Regra prática para código novo.** Antes de criar um schema, pergunte o que ele é. Se representa uma entidade para ser embutida em outras respostas, é projeção — e projeção nova só entra em `api/schemas.py` com justificativa, porque cada uma vira vocabulário público. Se representa o retorno de um endpoint, mora no app da rota, mesmo que cite três entidades de apps diferentes. **Não centralize um schema só para evitar um import.**

**Consequências.**
- Positivas: cada app é legível e apagável isoladamente; o layout casa com a doutrina do Django e com a documentação do Ninja; as dependências entre apps ficam visíveis nos imports, em vez de escondidas num arquivo comum; a superfície compartilhada é pequena o bastante (duas classes) para ser revisada de olho.
- Negativas: a divisão entre projeção e formato de resposta é uma disciplina que precisa ser mantida — nada no Python impede alguém de embutir um `UserProfileOut` dentro de outra coisa e reintroduzir um ciclo. E `api/schemas.py`, por conter `BookOut` (um `ModelSchema`), importa `books.models`: a camada compartilhada conhece um domínio. Não é ciclo, mas é o preço de a projeção ser derivada do modelo.

**Corolário: o `operationId` não pode depender do layout.** O padrão do Ninja monta o `operationId` como `<módulo>_<view>`, o que amarra o contrato público à árvore de arquivos: mover uma rota de app renomeia a operação e faz o `generated.ts` do frontend mudar sem que nada da API tenha mudado. Como esta decisão é justamente sobre mover arquivos, o `get_openapi_operation_id` foi sobrescrito para usar **só o nome da view** — `read_me`, `search_books`, `update_reading`. Sem isso, a frase seguinte seria falsa.

O preço é que os nomes de view passam a ser únicos em toda a API, não só dentro do app. Não é combinação a se confiar na memória: `api/test_api.py` falha se dois nomes colidirem ou se um `operationId` voltar a carregar nome de módulo.

**Custo de reversão.** Baixo e simétrico. Voltar à fachada é mover quatro arquivos e reunir os schemas; o contrato HTTP e o OpenAPI não mudam em nenhuma das direções — isto é decisão de layout de código, não de API.

**Quando revisar.** Se um app de domínio passar a importar schemas de dois outros, ou se as projeções em `api/schemas.py` passarem de meia dúzia. Qualquer um dos dois indica que a fronteira entre apps parou de corresponder ao domínio.

---

## Resumo executivo

Se for para levar uma frase de cada decisão:

1. **Django** porque o clube precisa de uma interface administrativa e de autenticação prontas, não de async.
2. **Ninja** porque dá a ergonomia moderna de API sem abrir mão do ORM e do Admin.
3. **API como caminho principal de dados** por objetivo de aprendizado, declarado como tal — o nível 1 bastaria. Mas, **dada essa escolha, o mono-repo é o caminho mais simples**, não uma concessão: é ele que elimina CORS, JWT e contrato duplicado.
4. **Mesma origem** porque evita uma classe inteira de problemas que só existe quando se separa.
5. **Modelagem em torno de `MonthlyPick` e `MonthlyReading`** porque o histórico é requisito e o booleano o destruiria.
6. **Admin como primeira entrega** porque é o seguro barato contra o único risco real do projeto.
7. **Apps autocontidos, com só as projeções compartilhadas** porque schema de resposta pertence à rota, não à entidade que ele cita.
