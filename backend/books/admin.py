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
    # "rating" is the model property, so the column reads 3.5 rather than the 7 the database
    # holds; rating_halves is excluded so the founder is never shown both numbers for one rating.
    readonly_fields = ("user", "pages_read", "rating", "updated_at")
    exclude = ("rating_halves",)
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
