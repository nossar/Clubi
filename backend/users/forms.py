from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from .models import User


class SignupForm(UserCreationForm):
    """Public sign-up form: Django's user creation form plus the club's own fields."""

    full_name = forms.CharField(label="Nome completo", max_length=120)
    email = forms.EmailField(
        label="E-mail",
    )

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("username", "full_name", "email")

    def clean_email(self):
        # The model does not enforce uniqueness, but a shared address would make the
        # password reset ambiguous — two accounts would get the same message.
        email = self.cleaned_data["email"]
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("Já existe uma conta com este e-mail.")
        return email


class LoginForm(AuthenticationForm):
    """Django's login form relabelled: the field takes a username or an e-mail."""

    def __init__(self, request=None, *args, **kwargs):
        super().__init__(request, *args, **kwargs)
        self.fields["username"].label = "Usuário ou e-mail"
        self.error_messages = {
            **self.error_messages,
            "invalid_login": "Usuário (ou e-mail) e senha não conferem. Confira os dois campos.",
        }
