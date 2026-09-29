"""`seed_landing_carousel`: the two refusals are the point, the seeding is the convenience.

There is a production database and a production bucket now (ADR-11, ADR-13). A command that
invents picks and writes covers into storage must fail closed, and the way it fails has to be
asserted rather than trusted — the failure mode of a guard is someone editing the condition.
"""

import re
from io import StringIO

import pytest
from django.core.management import CommandError, call_command
from django.utils import timezone

from books.models import Book, MonthlyPick
from core.management.commands.seed_landing_carousel import SEED_MARK

pytestmark = pytest.mark.django_db


def seed(*args):
    out = StringIO()
    call_command("seed_landing_carousel", *args, stdout=out)
    return out.getvalue()


class TestGuards:
    def test_refuses_outside_debug(self, settings):
        settings.DEBUG = False
        settings.R2_BUCKET = ""

        with pytest.raises(CommandError, match="DEBUG=True"):
            seed()

        assert MonthlyPick.objects.count() == 0

    def test_refuses_when_r2_is_configured(self, settings):
        """DEBUG=True with a bucket set is a legitimate local setup — and exactly the one where
        fake covers would land in the real store."""
        settings.DEBUG = True
        settings.R2_BUCKET = "clubi-media"

        with pytest.raises(CommandError, match="R2_BUCKET"):
            seed()

        assert MonthlyPick.objects.count() == 0

    def test_clear_is_guarded_too(self, settings):
        settings.DEBUG = False

        with pytest.raises(CommandError):
            seed("--clear")


class TestSeeding:
    @pytest.fixture(autouse=True)
    def dev_settings(self, settings):
        settings.DEBUG = True
        settings.R2_BUCKET = ""

    def test_fills_the_months_before_this_one(self, media_root):
        seed("--months", "3")

        picks = list(MonthlyPick.objects.order_by("-month"))
        this_month = timezone.localdate().replace(day=1)
        assert len(picks) == 3
        assert all(pick.month < this_month for pick in picks)
        assert all(pick.ends_on < timezone.localdate() for pick in picks)
        assert all(SEED_MARK in pick.blurb for pick in picks)
        # Covers are drawn locally and land in the storage settings.py points at — never fetched.
        for pick in picks:
            assert re.match(r"^covers/[0-9a-f]{32}\.jpg$", pick.book.cover.name)
            assert (media_root / pick.book.cover.name).is_file()

    def test_leaves_existing_months_alone(self, pick):
        """The founder's real pick for this month, and any month already filled, survive."""
        seed("--months", "2")

        assert MonthlyPick.objects.filter(pk=pick.pk).exists()
        assert MonthlyPick.objects.count() == 3

    def test_is_idempotent(self):
        seed("--months", "4")
        before = set(MonthlyPick.objects.values_list("pk", flat=True))

        output = seed("--months", "4")

        assert "0 pick(s) criado(s)" in output
        assert set(MonthlyPick.objects.values_list("pk", flat=True)) == before

    def test_clear_removes_only_what_it_seeded(self, pick, media_root):
        seed("--months", "2")
        mock_files = [
            media_root / book.cover.name
            for book in Book.objects.filter(synopsis__contains=SEED_MARK)
        ]
        assert mock_files

        seed("--clear")

        assert list(MonthlyPick.objects.all()) == [pick]
        assert Book.objects.filter(pk=pick.book.pk).exists()
        assert not Book.objects.filter(cover__startswith="covers/mock-").exists()
        assert not any(path.exists() for path in mock_files)
