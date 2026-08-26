from django.conf import settings
from django.db import models


class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    title = models.CharField(max_length=140)
    body = models.TextField()
    book = models.ForeignKey(
        "books.Book",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="posts",
    )
    published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["-created_at"])]

    def __str__(self):
        return self.title


class PostImage(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="images")
    file = models.ImageField(upload_to="posts/%Y/%m/")
    position = models.PositiveSmallIntegerField(default=1)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["post", "position"], name="one_image_per_slot"),
            models.CheckConstraint(
                condition=models.Q(position__gte=1, position__lte=4),
                name="image_position_between_1_and_4",
            ),
        ]

    def __str__(self):
        return f"{self.post.title} #{self.position}"
