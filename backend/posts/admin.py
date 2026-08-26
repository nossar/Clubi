from django.contrib import admin

from .models import Post, PostImage


class PostImageInline(admin.TabularInline):
    model = PostImage
    extra = 0
    max_num = 4


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "created_at", "published")
    list_filter = ("published", "created_at")
    search_fields = ("title", "body")
    inlines = [PostImageInline]
    actions = ["unpublish"]

    @admin.action(description="Unpublish selected posts")
    def unpublish(self, request, queryset):
        queryset.update(published=False)
