import re

import pytest
from django.core import mail
from django.urls import reverse

from users.models import User

pytestmark = pytest.mark.django_db

PASSWORD = "livro-do-mes-2026"


@pytest.fixture
def member():
    return User.objects.create_user(
        username="ana",
        email="ana@espm.br",
        password=PASSWORD,
        full_name="Ana Ribeiro",
    )


def signup_payload(**overrides):
    data = {
        "username": "bruno",
        "full_name": "Bruno Alves",
        "email": "bruno@espm.br",
        "password1": PASSWORD,
        "password2": PASSWORD,
    }
    return data | overrides


class TestSignup:
    def test_creates_user_and_logs_in(self, client):
        response = client.post(reverse("signup"), signup_payload())

        assert response.status_code == 302
        assert response.url == "/"
        user = User.objects.get(username="bruno")
        assert user.full_name == "Bruno Alves"
        assert client.session["_auth_user_id"] == str(user.pk)

    def test_rejects_email_already_registered(self, client, member):
        response = client.post(reverse("signup"), signup_payload(email="ANA@espm.br"))

        assert response.status_code == 200
        assert not User.objects.filter(username="bruno").exists()
        assert "Já existe uma conta com este e-mail." in response.content.decode()

    def test_redirects_authenticated_user(self, client, member):
        client.force_login(member)

        response = client.get(reverse("signup"))

        assert response.status_code == 302
        assert response.url == "/"


class TestLogin:
    def test_login_and_logout(self, client, member):
        response = client.post(reverse("login"), {"username": "ana", "password": PASSWORD})
        assert response.status_code == 302
        assert response.url == "/"

        response = client.post(reverse("logout"))
        assert response.status_code == 302
        assert "_auth_user_id" not in client.session

    def test_wrong_password_keeps_user_out(self, client, member):
        response = client.post(reverse("login"), {"username": "ana", "password": "nope"})

        assert response.status_code == 200
        assert "_auth_user_id" not in client.session

    def test_login_page_honours_next(self, client):
        response = client.get(reverse("login"), {"next": "/perfil/ana"})

        assert response.status_code == 200
        assert 'value="/perfil/ana"' in response.content.decode()


class TestPasswordReset:
    def test_full_reset_flow(self, client, member):
        response = client.post(reverse("password_reset"), {"email": "ana@espm.br"})
        assert response.status_code == 302
        assert len(mail.outbox) == 1

        link = re.search(r"/accounts/reset/[^\s]+", mail.outbox[0].body).group()
        # The confirm view swaps the token for a session-backed one and redirects.
        response = client.get(link, follow=True)
        assert response.status_code == 200

        new_password = "resenha-de-marco-2026"
        response = client.post(
            response.redirect_chain[-1][0] if response.redirect_chain else link,
            {"new_password1": new_password, "new_password2": new_password},
        )
        assert response.status_code == 302

        member.refresh_from_db()
        assert member.check_password(new_password)

    def test_unknown_email_reveals_nothing(self, client):
        response = client.post(reverse("password_reset"), {"email": "ninguem@espm.br"})

        assert response.status_code == 302
        assert response.url == reverse("password_reset_done")
        assert mail.outbox == []


class TestSpaShell:
    def test_unknown_path_serves_the_shell(self, client):
        response = client.get("/perfil/ana")

        assert response.status_code == 200
        assert "Clubi" in response.content.decode()

    def test_api_prefix_is_not_swallowed_by_the_shell(self, client):
        # /api/ is not mounted yet; it must 404 rather than render the SPA.
        assert client.get("/api/me").status_code == 404


class TestPagesRender:
    """Every template the /accounts/ routes can reach must exist."""

    @pytest.mark.parametrize(
        "name",
        ["login", "signup", "password_reset", "password_reset_done", "password_reset_complete"],
    )
    def test_anonymous_pages(self, client, name):
        assert client.get(reverse(name)).status_code == 200

    def test_reset_confirm_with_a_broken_link(self, client):
        response = client.get(reverse("password_reset_confirm", args=["MQ", "bad-token"]))

        assert response.status_code == 200
        assert "Link inválido" in response.content.decode()

    def test_password_change_pages(self, client, member):
        client.force_login(member)

        assert client.get(reverse("password_change")).status_code == 200
        assert client.get(reverse("password_change_done")).status_code == 200
