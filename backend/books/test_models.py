"""The half-star conversion, tested where it lives.

`MonthlyReading.rating_halves` is base 10 and `MonthlyReading.rating` is the 0-5 scale everything
outside the model speaks. These are the tests for the seam between them; the ones for the seam
between the model and the API are in test_api.py.
"""

import pytest
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError

from books.models import MonthlyReading

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    ("stars", "halves"),
    [(0, 0), (0.5, 1), (1, 2), (2.5, 5), (3.5, 7), (5, 10)],
)
def test_the_property_converts_both_ways(member, pick, stars, halves):
    reading = MonthlyReading.objects.create(user=member, pick=pick, rating=stars)

    assert reading.rating_halves == halves
    assert MonthlyReading.objects.get(pk=reading.pk).rating == stars


def test_no_rating_stays_none_in_both_directions(member, pick):
    reading = MonthlyReading.objects.create(user=member, pick=pick)

    assert reading.rating_halves is None
    assert reading.rating is None

    reading.rating = 4
    reading.rating = None

    assert reading.rating_halves is None


@pytest.mark.parametrize("stars", [0.25, 3.3, 4.99])
def test_a_rating_off_the_half_step_is_refused(member, pick, stars):
    reading = MonthlyReading(user=member, pick=pick)

    with pytest.raises(ValidationError):
        reading.rating = stars


@pytest.mark.parametrize("stars", [-0.5, -1, 5.5, 10])
def test_a_rating_off_the_scale_is_refused(member, pick, stars):
    reading = MonthlyReading(user=member, pick=pick)

    with pytest.raises(ValidationError):
        reading.rating = stars


def test_the_column_itself_is_bounded_by_a_check_constraint(member, pick):
    """Writing rating_halves directly bypasses the property — the database still says no."""
    with pytest.raises(IntegrityError):
        MonthlyReading.objects.create(user=member, pick=pick, rating_halves=11)
