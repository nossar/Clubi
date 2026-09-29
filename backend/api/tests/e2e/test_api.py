"""Tests for the mount point itself. Per-endpoint tests live with their app."""

import pytest

pytestmark = pytest.mark.django_db


DOCS_PATHS = ["/api/docs", "/api/openapi.json"]


class TestDocs:
    """Swagger and the raw schema are for development and for the organisation (ADR-19).

    The suite runs with DEBUG False, which is the production shape, so these assert what the
    deployed site does.
    """

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
