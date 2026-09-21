from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

from .models import User


class EmailOrUsernameBackend(ModelBackend):
    """ModelBackend that also accepts the account's e-mail in the username field.

    The username match stays exact, as in Django; the e-mail match is case-insensitive, the
    same way SignupForm de-duplicates it. Email is not unique at the model level, so a lookup
    that hits more than one account is refused rather than guessed.
    """

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if not username or password is None:
            return None
        try:
            user = User._default_manager.get(Q(username=username) | Q(email__iexact=username))
        except (User.DoesNotExist, User.MultipleObjectsReturned):
            # Run the hasher anyway so a miss costs the same time as a hit (as ModelBackend does).
            User().set_password(password)
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
