"""Tests for the mount point itself. Per-endpoint tests live with their app."""

import pytest

pytestmark = pytest.mark.django_db


class TestApiSurface:
    def test_docs_are_served(self, client):
        assert client.get("/api/docs").status_code == 200

    def test_an_unmounted_api_path_404s_instead_of_rendering_the_shell(self, client):
        response = client.get("/api/nao-existe")

        assert response.status_code == 404
        assert "Clubi" not in response.content.decode()

    @pytest.mark.parametrize(
        ("path", "expected"),
        [
            ("/api/users", 200),
            ("/api/books", 200),
            ("/api/monthly-picks", 200),
            ("/api/posts", 200),
            # Mounted with auth=django_auth, so anonymous is 401 — not 404.
            ("/api/me", 401),
        ],
    )
    def test_every_app_router_answers_under_its_prefix(self, client, path, expected):
        assert client.get(path).status_code == expected


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
