from django.contrib import admin

from .models import Book, Favorite, MonthlyPick, MonthlyReading


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "year", "pages")
    search_fields = ("title", "author")
    list_filter = ("year",)


class MonthlyReadingInline(admin.TabularInline):
    model = MonthlyReading
    extra = 0
    readonly_fields = ("user", "pages_read", "rating", "updated_at")
    can_delete = False


@admin.register(MonthlyPick)
class MonthlyPickAdmin(admin.ModelAdmin):
    list_display = ("month", "book", "starts_on", "ends_on", "reader_count")
    autocomplete_fields = ("book",)
    date_hierarchy = "month"
    inlines = [MonthlyReadingInline]

    @admin.display(description="Readers")
    def reader_count(self, obj):
        return obj.readings.count()


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "position", "book")
    list_filter = ("position",)
    autocomplete_fields = ("book",)
