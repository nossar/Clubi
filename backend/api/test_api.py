"""Tests for the mount point itself. Per-endpoint tests live with their app."""

import io

import pytest
from django.conf import settings
from django.core.management import call_command

pytestmark = pytest.mark.django_db


DOCS_PATHS = ["/api/docs", "/api/openapi.json"]


class TestDocs:
    """Swagger and the raw schema are for development and for the organisation (ADR-19).

    The suite runs with DEBUG False, which is the production shape, so these assert what the
    deployed site does.
    """

    def test_the_suite_runs_in_the_closed_branch(self):
        assert settings.DEBUG is False

    @pytest.mark.parametrize("path", DOCS_PATHS)
    def test_are_closed_to_an_anonymous_visitor(self, client, path):
        assert client.get(path).status_code == 404

    @pytest.mark.parametrize("path", DOCS_PATHS)
    def test_are_closed_to_a_plain_member(self, auth, path):
        assert auth.get(path).status_code == 404

    @pytest.mark.parametrize("path", DOCS_PATHS)
    def test_stay_open_to_the_organisation(self, staff_auth, path):
        assert staff_auth.get(path).status_code == 200

    def test_are_open_to_everyone_in_development(self, client, settings, path="/api/docs"):
        """The gate is decided per request, so DEBUG can be flipped here — which is the whole
        reason it is not read at import time."""
        settings.DEBUG = True

        assert client.get(path).status_code == 200

    def test_the_schema_is_still_exportable_for_make_types(self):
        """`make types` reads the schema through the management command, not over HTTP.

        export_openapi_schema resolves the instance via `resolve("/api/")` — the api-root url
        ninja appends unconditionally — so closing docs_url and openapi_url leaves the generated
        frontend types (ADR-12) untouched. If this breaks, `make types` is broken.
        """
        out = io.StringIO()
        call_command("export_openapi_schema", stdout=out)

        schema = out.getvalue()
        assert '"openapi"' in schema
        assert "read_me" in schema


class TestApiSurface:
    def test_an_unmounted_api_path_404s_instead_of_rendering_the_shell(self, client):
        response = client.get("/api/nao-existe")

        assert response.status_code == 404
        assert "Clubi" not in response.content.decode()

    @pytest.mark.parametrize(
        "path",
        ["/api/me", "/api/users", "/api/books", "/api/monthly-picks", "/api/posts"],
    )
    def test_every_app_router_answers_under_its_prefix(self, auth, path):
        """That a mounted prefix answers at all — the policy behind it is TestAnonymousAccess.

        A signed-in member is what this needs: since ADR-19 an anonymous GET is 401 everywhere,
        which would make this pass even for a prefix nobody mounted.
        """
        assert auth.get(path).status_code != 404


class TestOperationIds:
    """The operationId is public contract — it shows up in the generated client."""

    @staticmethod
    def _ids():
        from api.api import api

        schema = api.get_openapi_schema()
        return [
            op["operationId"] for methods in schema["paths"].values() for op in methods.values()
        ]

    def test_are_unique_across_the_whole_surface(self):
        ids = self._ids()

        assert len(ids) == len(set(ids)), "two views share a name; rename one"

    def test_do_not_encode_the_module_layout(self):
        # If these start carrying app names again, moving a route will churn
        # frontend/src/api/generated.ts for no reason (ADR-15).
        assert not [i for i in self._ids() if "_api_" in i or "routers" in i]
