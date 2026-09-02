"""URL configuration for the clubi project.

/admin/      → Django Admin
/accounts/   → rendered auth pages (login, signup, password reset)
/api/        → JSON API (Ninja), docs at /api/docs
/            → the landing page when anonymous, the SPA shell when signed in (ADR-18)
/*           → the SPA shell
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from api.api import api
from core.views import root, shell
from users.views import SignupView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    # Must come before the include() so it wins over auth's own patterns.
    path("accounts/signup/", SignupView.as_view(), name="signup"),
    path("accounts/", include("django.contrib.auth.urls")),
    # The root is the one path that answers with two different documents (ADR-18): the landing
    # page for a visitor, this same shell for a member. It has to be declared before the
    # catch-all, which would otherwise match "" as well — Django takes the first pattern that
    # matches, so order is the whole mechanism here. The catch-all's regex is untouched on
    # purpose: it is what makes a mistyped API path 404 instead of rendering HTML, and the
    # landing page is not a reason to go editing that lookahead.
    path("", root, name="root"),
    # everything else is handled by the SPA.
    # ensure_csrf_cookie is load-bearing: the SPA reads the csrftoken cookie to set the
    # X-CSRFToken header (ADR-04), and without it a visitor who already has a session but has
    # never submitted a rendered form gets every write rejected.
    re_path(r"^(?!static/|media/|api/|admin/|accounts/).*$", shell, name="spa"),
]

if settings.DEBUG:
    # In production media is served by R2 (or by the proxy); in dev, by Django itself.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
