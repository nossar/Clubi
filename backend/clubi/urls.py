"""URL configuration for the clubi project.

/admin/      → Django Admin
/accounts/   → rendered auth pages (login, signup, password reset)
/api/        → JSON API (Ninja), docs at /api/docs
/*           → the SPA shell
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.generic import TemplateView

from api.api import api
from users.views import SignupView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    # Must come before the include() so it wins over auth's own patterns.
    path("accounts/signup/", SignupView.as_view(), name="signup"),
    path("accounts/", include("django.contrib.auth.urls")),
    # everything else is handled by the SPA.
    # ensure_csrf_cookie is load-bearing: the SPA reads the csrftoken cookie to set the
    # X-CSRFToken header (ADR-04), and without it a visitor who already has a session but has
    # never submitted a rendered form gets every write rejected.
    re_path(
        r"^(?!static/|media/|api/|admin/|accounts/).*$",
        ensure_csrf_cookie(TemplateView.as_view(template_name="index.html")),
        name="spa",
    ),
]

if settings.DEBUG:
    # In production media is served by R2 (or by the proxy); in dev, by Django itself.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
