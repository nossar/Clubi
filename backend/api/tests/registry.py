"""The router registry walk shared by the unit and e2e halves of the ADR-19 policy tests."""

from api.api import api

# Filled into the path converters the registry hands back (`{username}`, `{int:post_id}`). The
# values only have to be well-formed: authentication runs before the view, so the row behind them
# is never read on the anonymous path these tests take.
PATH_PARAMS = {"username": "ana", "book_id": "1", "post_id": "1"}


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
