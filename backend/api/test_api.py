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

