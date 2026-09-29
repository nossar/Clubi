"""The authentication policy of ADR-19, asserted rather than declared.

The policy is one sentence — *the API is for members, and the exceptions are named in
`api.api.PUBLIC_OPERATIONS`* — and the point of this module is that no route can quietly fall
outside it. So the sweep below carries no list of paths: it walks the router registry that
`NinjaAPI` actually serves, which means a route added tomorrow is covered the moment it is
mounted, and a route nobody remembered to protect fails here instead of in production.

Per-endpoint behaviour still lives with its app. What lives here is the rule that spans them.
"""

from api.api import PUBLIC_OPERATIONS, api
from api.tests.registry import registered_operations


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
