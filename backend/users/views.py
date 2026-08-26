from django.conf import settings
from django.contrib.auth import login
from django.shortcuts import redirect
from django.views.generic import CreateView

from .forms import SignupForm


class SignupView(CreateView):
    form_class = SignupForm
    template_name = "registration/signup.html"
    success_url = "/"

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect(settings.LOGIN_REDIRECT_URL)
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        response = super().form_valid(form)
        login(self.request, self.object)
        return response
