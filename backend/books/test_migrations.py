"""The data migration that turned whole stars into half-stars.

It runs once against a real database, so it is tested the only way that proves anything: unapply
0002, write rows in the old shape through the historical models, and apply it again. Nothing here
imports books.models — at 0001 that model does not have the column this asserts on.
"""

from datetime import date, timedelta

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

BEFORE = ("books", "0001_initial")
AFTER = ("books", "0002_rating_in_half_stars")

# (rating as it was stored in 0-5, rating_halves it must become)
OLD_RATINGS = [(None, None), (0, 0), (1, 2), (3, 6), (5, 10)]


def migrate(target):
    """Run the plan to `target` and hand back the model registry as of that migration."""
    executor = MigrationExecutor(connection)
    executor.loader.build_graph()
    executor.migrate([target])
    return executor.loader.project_state([target]).apps


@pytest.fixture(autouse=True)
def leave_the_database_migrated():
    """A failed assertion here would otherwise strand the schema at 0001 for the whole session."""
    yield
    migrate(AFTER)


@pytest.mark.django_db(transaction=True)
def test_existing_ratings_are_doubled_and_no_reading_is_lost():
    old_apps = migrate(BEFORE)

    User = old_apps.get_model("users", "User")
    Book = old_apps.get_model("books", "Book")
    MonthlyPick = old_apps.get_model("books", "MonthlyPick")
    MonthlyReading = old_apps.get_model("books", "MonthlyReading")

    book = Book.objects.create(title="Grande Sertão: Veredas", author="João Guimarães Rosa")
    for index, (rating, _) in enumerate(OLD_RATINGS):
        month = date(2026, 1, 1) + timedelta(days=31 * index)
        pick = MonthlyPick.objects.create(
            book=book,
            month=month.replace(day=1),
            starts_on=month,
            ends_on=month + timedelta(days=20),
        )
        user = User.objects.create(username=f"member{index}", password="x")
        MonthlyReading.objects.create(user=user, pick=pick, pages_read=index, rating=rating)

    new_apps = migrate(AFTER)
    Migrated = new_apps.get_model("books", "MonthlyReading")

    assert Migrated.objects.count() == len(OLD_RATINGS)
    assert sorted(Migrated.objects.values_list("pages_read", "rating_halves")) == sorted(
        (index, halves) for index, (_, halves) in enumerate(OLD_RATINGS)
    )


@pytest.mark.django_db(transaction=True)
def test_the_migration_reverses_back_to_whole_stars():
    new_apps = migrate(AFTER)
    Reading = new_apps.get_model("books", "MonthlyReading")

    book = new_apps.get_model("books", "Book").objects.create(title="T", author="A")
    pick = new_apps.get_model("books", "MonthlyPick").objects.create(
        book=book,
        month=date(2026, 1, 1),
        starts_on=date(2026, 1, 1),
        ends_on=date(2026, 1, 31),
    )
    user = new_apps.get_model("users", "User").objects.create(username="ana", password="x")
    Reading.objects.create(user=user, pick=pick, rating_halves=6)

    old_apps = migrate(BEFORE)

    assert old_apps.get_model("books", "MonthlyReading").objects.get().rating == 3
