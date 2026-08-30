from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "full_name", "email", "is_staff")
    search_fields = ("username", "full_name", "email")
    # posts_seen_at is written by the API when a member opens the feed, never by hand — it is
    # here so the founder can see why someone's badge says what it says, not to be edited.
    readonly_fields = ("posts_seen_at",)
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Clubi",
            {"fields": ("full_name", "birth_date", "photo", "quote", "posts_seen_at")},
        ),
    )
