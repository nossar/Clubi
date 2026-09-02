from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    # username, email, password and is_active come from AbstractUser
    full_name = models.CharField(max_length=120, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    photo = models.ImageField(upload_to="profiles/", null=True, blank=True)
    quote = models.CharField(max_length=180, blank=True)
    # "I have seen the postagens up to here" — the mark the unread badge counts from. NULL
    # means the member has never opened the feed, so everything published counts as unread;
    # that is also what every existing member gets the day this ships, and it clears itself
    # the first time they open /posts.
    posts_seen_at = models.DateTimeField(null=True, blank=True)

    favorites = models.ManyToManyField(
        "books.Book", through="books.Favorite", related_name="favorited_by"
    )

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name or self.username
