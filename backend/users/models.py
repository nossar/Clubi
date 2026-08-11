from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # username, email, password and is_active come from AbstractUser
    full_name = models.CharField(max_length=120, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    photo = models.ImageField(upload_to="profiles/", null=True, blank=True)
    quote = models.CharField(max_length=180, blank=True)

    # The `favorites` M2M (through books.Favorite) lands with the books app.

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name or self.username
