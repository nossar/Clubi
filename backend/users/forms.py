from django import forms
from django.contrib.auth.forms import UserCreationForm

from .models import User


class SignupForm(UserCreationForm):
    """Public sign-up form: Django's user creation form plus the club's own fields."""

    full_name = forms.CharField(label="Nome completo", max_length=120)
    email = forms.EmailField(
        label="E-mail",
        help_text="Usado para recuperar a senha. Prefira o e-mail da ESPM.",
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
