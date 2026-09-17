"""The authentication policy of ADR-19, asserted rather than declared.

The policy is one sentence — *the API is for members, and the exceptions are named in
`api.api.PUBLIC_OPERATIONS`* — and the point of this module is that no route can quietly fall
outside it. So the sweep below carries no list of paths: it walks the router registry that
`NinjaAPI` actually serves, which means a route added tomorrow is covered the moment it is
mounted, and a route nobody remembered to protect fails here instead of in production.

Per-endpoint behaviour still lives with its app. What lives here is the rule that spans them.
"""

import json

import pytest
from django.test import Client
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

from api.api import PUBLIC_OPERATIONS, api
from books.models import MonthlyReading
from posts.models import Post

pytestmark = pytest.mark.django_db

# Filled into the path converters the registry hands back (`{username}`, `{int:post_id}`). The
# values only have to be well-formed: authentication runs before the view, so the row behind them
# is never read on the anonymous path these tests take.
PATH_PARAMS = {"username": "ana", "book_id": "1", "post_id": "1"}

# A minimal valid body per write, so a 401 is authentication answering rather than a parser
# rejecting the request first. The two multipart routes are handled in `_call` instead.
PAYLOADS = {
    "update_me": {"quote": "Ler é resistir."},
    "save_favorites": {"favorites": []},
    "create_book": {"title": "Vidas Secas", "author": "Graciliano Ramos"},
    "update_reading": {"pages_read": 10},
    "create_post": {"title": "Sobre o sertão", "body": "Uma leitura."},
    "mark_posts_seen": {},
    "update_post": {"title": "Outro título"},
}


def registered_operations():
    """Every operation the API serves, as (operation_id, method, url).

    Walks `api._routers` — the registry `NinjaAPI` builds its URLConf from — rather than the
    OpenAPI schema or a list written by hand. A hand-written list is exactly the thing that goes
    stale without failing, which is what this module exists to prevent.
    """
    found = []
    for prefix, router in api._routers:
        for path, path_view in router.path_operations.items():
            for operation in path_view.operations:
                url = f"/api{prefix}{path}"
                for name, value in PATH_PARAMS.items():
                    url = url.replace(f"{{{name}}}", value).replace(f"{{int:{name}}}", value)
                assert "{" not in url, f"no test value for a path param in {url}"
                for method in operation.methods:
                    found.append((operation.view_func.__name__, method, url))
    return sorted(found)


def _call(client, method, url, operation_id):
    """Make the request the way the SPA would, minus the session."""
    if operation_id == "upload_photo":
        return client.put(
            url, encode_multipart(BOUNDARY, {"file": "x"}), content_type=MULTIPART_CONTENT
        )
    if operation_id == "attach_image":
        return client.post(url, {"file": "x"})
    if method == "GET":
        return client.get(url)
    if method == "DELETE":
        return client.delete(url)
    return client.generic(
        method,
        url,
        data=json.dumps(PAYLOADS.get(operation_id, {})),
        content_type="application/json",
    )


class TestTheRegistryIsWalkable:
    """If these break, every sweep below is silently testing nothing."""

    def test_the_sweep_sees_every_operation_in_the_openapi_schema(self):
        from_registry = {op for op, _, _ in registered_operations()}
        schema = api.get_openapi_schema()
        from_schema = {
            op["operationId"] for methods in schema["paths"].values() for op in methods.values()
        }

        assert from_registry == from_schema

    def test_the_sweep_is_not_empty(self):
        # A traversal that quietly returned [] would make every parametrisation below vacuous.
        assert len(registered_operations()) > 20

    def test_every_public_operation_is_a_real_one(self):
        """A misspelled entry in PUBLIC_OPERATIONS would otherwise be ignored by both sweeps.

        They start from the registry and filter by the set, so a name matching no operation
        produces no case in either direction: the route it was meant to open stays closed and
        passes the 401 sweep, and the public sweep runs on nothing at all. That drift is
        fail-closed, but it is silent, which is the one thing ADR-19 is trying not to be.
        """
        unknown = PUBLIC_OPERATIONS - {op for op, _, _ in registered_operations()}

        assert not unknown, (
            f"PUBLIC_OPERATIONS names operations that do not exist: {sorted(unknown)}; "
            "check the spelling against the view function names"
        )


class TestAnonymousAccess:
    """ADR-19: closed by default. Every operation not named public answers 401 to a stranger."""

    @pytest.mark.parametrize(
        ("operation_id", "method", "url"),
        [op for op in registered_operations() if op[0] not in PUBLIC_OPERATIONS],
    )
    def test_a_closed_operation_refuses_an_anonymous_caller(
        self, client, operation_id, method, url
    ):
        response = _call(client, method, url, operation_id)

        # 401 specifically, not merely "not 2xx". A 403 here would mean the request got past
        # authentication and was stopped by an authorship or is_staff check — the right outcome
        # reached the wrong way, and one that would survive the global auth being removed.
        assert response.status_code == 401, (
            f"{method} {url} ({operation_id}) answered {response.status_code} to an anonymous "
            "caller; it is not in PUBLIC_OPERATIONS, so it must answer 401"
        )

    @pytest.mark.parametrize(
        ("operation_id", "method", "url"),
        [op for op in registered_operations() if op[0] in PUBLIC_OPERATIONS],
    )
    def test_a_public_operation_lets_an_anonymous_caller_through(
        self, client, operation_id, method, url
    ):
        """The mirror of the sweep, and today it has nothing to run on.

        PUBLIC_OPERATIONS is empty, so this parametrisation is empty too — deliberately. It is
        written now so that the day somebody adds an entry, the entry has to *work*: naming a
        route public and leaving it 401 is a contradiction that should fail out loud rather than
        sit unnoticed in a constant. A 404 counts as through — an empty database is not a refusal.
        """
        response = _call(client, method, url, operation_id)

        assert response.status_code != 401
        assert response.status_code < 500


class TestMemberDataIsNotReadableByStrangers:
    """The rule ADR-19 exists for, asserted on its own rather than as a side effect of the sweep.

    A refactor that moved these routes, renamed their views or split the router would slide past a
    sweep keyed on operation ids. It must not slide past this. A birth date, a review and a
    member's real name are personal data of identifiable students, written for the club and not
    for the web, and `GET /api/users/{username}` handed all three to anyone who could guess a
    username until this decision.
    """

    @pytest.fixture
    def member_with_everything_filled_in(self, member, pick):
        member.birth_date = "2004-03-14"
        member.quote = "Ler é resistir."
        member.save(update_fields=["birth_date", "quote"])
        MonthlyReading.objects.create(
            user=member,
            pick=pick,
            pages_read=600,
            rating_halves=8,
            review="Achei o meio arrastado, mas o fim compensa.",
        )
        Post.objects.create(author=member, title="Sobre o sertão", body="Uma leitura.")
        return member

    def test_a_profile_is_401_to_an_anonymous_caller(
        self, client, member_with_everything_filled_in
    ):
        assert client.get("/api/users/ana").status_code == 401

    def test_the_member_directory_is_401_to_an_anonymous_caller(
        self, client, member_with_everything_filled_in
    ):
        assert client.get("/api/users").status_code == 401
        assert client.get("/api/users?q=ana").status_code == 401
        assert client.get("/api/users?q=").status_code == 401

    def test_no_anonymous_response_anywhere_leaks_a_birth_date_a_review_or_a_name(
        self, client, member_with_everything_filled_in
    ):
        """Swept across the whole surface, because the leak need not be on the profile.

        A readers list, a feed item's author, a reading history embedded in some future response —
        any of them would do. So this reads every anonymous body there is and looks for the data
        itself, rather than for the route that was expected to be carrying it.
        """
        leaks = []
        for operation_id, method, url in registered_operations():
            body = _call(client, method, url, operation_id).content.decode()
            for secret in ("2004-03-14", "arrastado", "Ana Ribeiro", "Ler é resistir"):
                if secret in body:
                    leaks.append(f"{method} {url} ({operation_id}) leaked {secret!r}")

        assert not leaks, "anonymous responses carried member data:\n" + "\n".join(leaks)


class TestCsrf:
    """Writes are CSRF-checked, and it is `django_auth` that does the checking.

    django-ninja marks every API view `csrf_exempt` at the Django middleware level and moves the
    check into the auth class (`APIKeyCookie._get_key` → `ninja.utils.check_csrf`). That is the
    mechanism ADR-04 leans on, and the reason the global `auth=` of ADR-19 matters twice over: a
    route without auth would be a route without CSRF. The default test client sets
    `_dont_enforce_csrf_checks`, so proving any of this takes a client that does not.
    """

    @pytest.fixture
    def csrf_client(self, member):
        client = Client(enforce_csrf_checks=True)
        client.force_login(member)
        return client

    def test_a_write_without_the_header_is_refused(self, csrf_client, member):
        response = csrf_client.patch(
            "/api/me", {"quote": "Sem token."}, content_type="application/json"
        )

        assert response.status_code == 403
        assert "CSRF" in response.json()["detail"]
        member.refresh_from_db()
        assert member.quote == ""

    def test_the_same_write_goes_through_with_the_header(self, csrf_client, member):
        # The API never sets the csrftoken cookie; the shell does, through the ensure_csrf_cookie
        # in clubi/urls.py. So this is the real ADR-04 sequence — load the page, read the cookie
        # off it, put it in the header — rather than a token conjured in the test.
        csrf_client.get("/")
        token = csrf_client.cookies["csrftoken"].value

        response = csrf_client.patch(
            "/api/me",
            {"quote": "Com token."},
            content_type="application/json",
            headers={"x-csrftoken": token},
        )

        assert response.status_code == 200
        member.refresh_from_db()
        assert member.quote == "Com token."

    def test_a_read_needs_no_token(self, csrf_client):
        """CsrfViewMiddleware.process_view exempts the safe methods, which is what lets the global
        auth of ADR-19 cover every GET without breaking a single one."""
        assert csrf_client.get("/api/me").status_code == 200
