"""
Django settings for clubi project.

https://docs.djangoproject.com/en/6.0/ref/settings/
"""

import os
from pathlib import Path

import dj_database_url
from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Security

DEBUG = config("DEBUG", default=False, cast=bool)

if DEBUG:
    # Development-only fallback. Production must provide a real key.
    SECRET_KEY = config(
        "SECRET_KEY", default="django-insecure-dev-only-key-never-use-in-production"
    )
else:
    SECRET_KEY = config("SECRET_KEY")  # raises if missing

ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())

X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_HTTPONLY = True

# Render (and most PaaS) terminate TLS at the proxy.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

if config("SECURE_HTTPS", default=not DEBUG, cast=bool):
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    # SecurityMiddleware runs first and would answer the platform's health check with a 301
    # before core.views.healthz ever ran. Render counts a 3xx as healthy, so nothing would look
    # broken — the check would just stop proving what it exists to prove, since the internal
    # probe reaches the container over plain HTTP and only the proxy sets X-Forwarded-Proto.
    SECURE_REDIRECT_EXEMPT = [r"^healthz$"]


# Application definition

AUTH_USER_MODEL = "users.User"
# Members may sign in with their username or their e-mail; see users/backends.py.
AUTHENTICATION_BACKENDS = ["users.backends.EmailOrUsernameBackend"]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party — needed for /api/docs templates and export_openapi_schema.
    "ninja",
    "core",
    "users",
    "books",
    "posts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    # Django only populates request.FILES on POST; PUT /api/me/photo needs this.
    "ninja.compatibility.files.fix_request_files_middleware",
]

ROOT_URLCONF = "clubi.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "clubi.wsgi.application"


# Database
# https://docs.djangoproject.com/en/6.0/ref/settings/#databases

# The one setting that cannot come from backend/.env: dj_database_url reads os.environ directly,
# and python-decouple never injects the file into the environment — it only answers config().
# Locally that is the intent rather than a limitation, since no DATABASE_URL means the sqlite file
# below, which is what every developer machine runs on.
DATABASE_URL = os.environ.get("DATABASE_URL", "")

DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL or f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        # Neon closes an idle connection when it suspends the compute after five minutes without
        # a query (ADR-13). A pooled connection would be reused after that and raise "server
        # closed the connection unexpectedly" — a 500 for the first visitor after every quiet
        # spell, which on this site is most of the day. Reconnecting costs tens of milliseconds
        # with the app and the database in the same region; the 500 costs a member.
        conn_max_age=0,
        # Tied to the URL and not to DEBUG. dj_database_url sets OPTIONS["sslmode"] whatever the
        # backend turns out to be, and sqlite rejects it: with ssl_require=not DEBUG, running
        # DEBUG=False against the local file — the rehearsal the deploy guide asks for before
        # shipping — died with "'sslmode' is an invalid keyword argument for Connection()".
        ssl_require=bool(DATABASE_URL),
    )
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# Password validation
# https://docs.djangoproject.com/en/6.0/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# Internationalization
# https://docs.djangoproject.com/en/6.0/topics/i18n/

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True


# Authentication

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"


# Email
# Only used by the password reset flow. In development the messages are printed to the
# console; a real SMTP host is required in production for the reset to work at all.

EMAIL_BACKEND = config("EMAIL_BACKEND", default="") or (
    "django.core.mail.backends.console.EmailBackend"
    if DEBUG
    else "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="Clubi <nao-responda@clubi.local>")

# Reset links stay valid for 3 hours.
PASSWORD_RESET_TIMEOUT = 60 * 60 * 3


# Static files and media

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# The SPA build output; only present once the frontend has been built.
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.is_dir() else []

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

R2_BUCKET = config("R2_BUCKET", default="")

if R2_BUCKET:
    default_storage = {
        "BACKEND": "storages.backends.s3.S3Storage",
        "OPTIONS": {
            "bucket_name": R2_BUCKET,
            "endpoint_url": config("R2_ENDPOINT"),
            "access_key": config("R2_ACCESS_KEY"),
            "secret_key": config("R2_SECRET_KEY"),
            "custom_domain": config("R2_PUBLIC_DOMAIN"),
            "default_acl": None,
            "querystring_auth": False,
            "region_name": "auto",
            # FileSystemStorage never overwrites; match it, or two members who both
            # upload "foto.jpg" to profiles/ end up sharing one photo.
            "file_overwrite": False,
            # Safe only because the line above makes every key immutable.
            "object_parameters": {"CacheControl": "public, max-age=31536000, immutable"},
        },
    }
else:
    # No R2 configured: keep user uploads on the local filesystem.
    default_storage = {"BACKEND": "django.core.files.storage.FileSystemStorage"}

if not DEBUG:
    if not DATABASE_URL:
        # Without this the site would come up on the sqlite file, on Render's ephemeral disk, and
        # work — until the next deploy replaced the container and took every member with it. The
        # failure is silent in a way the others here are not, which is why it is worth a guard.
        raise ImproperlyConfigured(
            "DATABASE_URL é obrigatório fora de DEBUG: sem ele o site sobe em SQLite num disco "
            "efêmero e perde todos os dados a cada deploy."
        )
    if not R2_BUCKET:
        raise ImproperlyConfigured("R2_BUCKET é obrigatório fora de DEBUG (ADR-11).")
    if not STATICFILES_DIRS:
        raise ImproperlyConfigured("frontend/dist ausente: o build do frontend não rodou.")

STORAGES = {
    "default": default_storage,
    "staticfiles": {
        # The hashed manifest only exists after collectstatic, so keep it out of dev.
        "BACKEND": (
            "django.contrib.staticfiles.storage.StaticFilesStorage"
            if DEBUG
            else "whitenoise.storage.CompressedManifestStaticFilesStorage"
        ),
    },
}


# Error monitoring (Sentry, ADR-20)
# Nothing initialises without a DSN, so development machines, CI and pytest never send an event.

SENTRY_DSN = config("SENTRY_DSN", default="")

if SENTRY_DSN:
    import sentry_sdk

    def _scrub_event(event, hint):
        """Last gate before an event leaves the process (ADR-20).

        The SDK's argv integration puts the whole command line in `extra["sys.argv"]`. For
        gunicorn that is noise; for `manage.py shell -c "…"` it is the *entire script*, which
        is how a one-off command carrying a secret or a member's data ends up in a payload.
        Nothing here needs it, so it goes.
        """
        extra = event.get("extra")
        if extra:
            extra.pop("sys.argv", None)
        return event

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=config("SENTRY_ENVIRONMENT", default="development" if DEBUG else "production"),
        # Render injects the deployed commit; locally there is none, and None is what the SDK
        # expects for "unknown release" — an empty string would tag every event with "".
        release=config("RENDER_GIT_COMMIT", default=None),
        # The three options below are the ADR-20 payload contract, and the Sentry quickstart
        # snippet contradicts the first of them (`send_default_pii=True`). What is at stake is
        # student data: a member's e-mail, IP and session on every event, the resenha they were
        # writing in the local variables of the frame that raised, and the request body of the
        # PUT that carried it. None of it is needed to read a stack trace.
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=_scrub_event,
        # Errors only. Tracing would sample ordinary requests, and the free plan's quota is
        # better spent on the events that mean something.
        traces_sample_rate=0.0,
    )
