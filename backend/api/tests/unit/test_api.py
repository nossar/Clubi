"""Tests for the mount point itself. Per-endpoint tests live with their app."""

import io

from django.conf import settings
from django.core.management import call_command


class TestDocs:
    """Swagger and the raw schema are for development and for the organisation (ADR-19).

    The suite runs with DEBUG False, which is the production shape, so these assert what the
    deployed site does.
    """

    def test_the_suite_runs_in_the_closed_branch(self):
        assert settings.DEBUG is False

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
