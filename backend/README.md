# Backend do Clubi

## Testes

Os testes ficam dentro de cada app, em `<app>/tests/<categoria>/`, e só existem as pastas de categoria que têm teste. A categoria diz o que o teste exercita:

| Categoria | O que toca | Exemplos |
|---|---|---|
| `unit` | nem banco, nem HTTP | `get_openapi_operation_id`, `compress_image`, `RandomKey` |
| `integration` | ORM/banco, sem passar por URL ou middleware | constraint da nota, migration de meia-estrela, `seed_landing_carousel` |
| `e2e` | requisição completa pelo test client: roteamento, middleware, sessão e auth | endpoints da API, varredura de 401, landing em `/`, `Vary: Cookie` |

O marker de cada teste vem da pasta onde ele está (o `conftest.py` aplica), então não é preciso escrevê-lo no arquivo. Todos os comandos rodam a partir de `backend/`:

```bash
uv run pytest                                  # suíte inteira
uv run pytest -m unit                          # só unit — segundos, sem banco
uv run pytest -m integration                   # só integration
uv run pytest -m e2e                           # só e2e
uv run pytest -m "not e2e"                     # unit + integration
uv run pytest books/tests/                     # um app inteiro
uv run pytest users/tests/e2e/test_auth.py::TestLogin::test_login_and_logout   # um teste
```

Pela raiz do repositório, `make check` (ou `mingw32-make check` no Windows com MSYS2) roda `manage.py check` e a suíte inteira.
