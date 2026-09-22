import pytest
from django.utils import timezone

from books.models import REVIEW_MAX_LENGTH, Book, MonthlyReading

pytestmark = pytest.mark.django_db


class TestBooks:
    def test_search_filters_by_title_and_author(self, auth, book):
        Book.objects.create(title="Outro livro", author="Outra pessoa")

        assert len(auth.get("/api/books").json()) == 2
        assert len(auth.get("/api/books?q=guimarães").json()) == 1

    def test_create_requires_login(self, client):
        response = client.post(
            "/api/books", {"title": "X", "author": "Y"}, content_type="application/json"
        )

        assert response.status_code == 401

    def test_create_is_idempotent_on_title_and_author(self, auth, member):
        payload = {"title": "Vidas Secas", "author": "Graciliano Ramos", "pages": 176}

        first = auth.post("/api/books", payload, content_type="application/json")
        second = auth.post("/api/books", payload, content_type="application/json")

        assert first.status_code == second.status_code == 200
        assert first.json()["id"] == second.json()["id"]
        assert Book.objects.filter(title="Vidas Secas").count() == 1
        assert Book.objects.get(title="Vidas Secas").added_by == member

    def test_detail_and_404(self, auth, book):
        assert auth.get(f"/api/books/{book.id}").json()["title"] == book.title
        assert auth.get("/api/books/9999").status_code == 404

    def test_external_search_maps_open_library(self, auth, monkeypatch):
        class FakeResponse:
            @staticmethod
            def raise_for_status():
                return None

            @staticmethod
            def json():
                return {
                    "docs": [
                        {
                            "key": "/works/OL27448W",
                            "title": "Dom Casmurro",
                            "author_name": ["Machado de Assis"],
                            "first_publish_year": 1899,
                            "number_of_pages_median": 256,
                            "cover_i": 42,
                        }
                    ]
                }

        monkeypatch.setattr("books.api.requests.get", lambda *a, **kw: FakeResponse())

        body = auth.get("/api/books/external?q=dom+casmurro").json()

        assert body == [
            {
                "external_id": "OL27448W",
                "title": "Dom Casmurro",
                "author": "Machado de Assis",
                "year": 1899,
                "pages": 256,
                "cover_url": "https://covers.openlibrary.org/b/id/42-L.jpg",
            }
        ]

    def test_external_search_requires_login(self, client):
        assert client.get("/api/books/external?q=x").status_code == 401


class TestMonthlyPicks:
    def test_current_is_404_without_an_active_pick(self, auth):
        assert auth.get("/api/monthly-picks/current").status_code == 404

    def test_current_returns_the_pick_and_its_book(self, auth, pick):
        body = auth.get("/api/monthly-picks/current").json()

        assert body["book"]["title"] == pick.book.title
        assert body["blurb"] == pick.blurb

    def test_history_lists_every_pick(self, auth, pick):
        assert len(auth.get("/api/monthly-picks").json()) == 1

    def test_reading_is_created_on_first_read(self, auth, member, pick):
        assert not MonthlyReading.objects.exists()

        response = auth.get("/api/monthly-picks/current/reading")

        assert response.status_code == 200
        assert response.json()["pages_read"] == 0
        assert MonthlyReading.objects.filter(user=member, pick=pick).exists()

    def test_progress_update_computes_percent(self, auth, pick):
        response = auth.put(
            "/api/monthly-picks/current/reading",
            {"pages_read": 150},
            content_type="application/json",
        )

        assert response.status_code == 200
        assert response.json()["percent"] == 25
        assert response.json()["finished_at"] is None

    def test_reaching_the_last_page_marks_it_finished(self, auth, pick):
        response = auth.put(
            "/api/monthly-picks/current/reading",
            {"pages_read": 600, "rating": 5, "review": "Vale cada página."},
            content_type="application/json",
        )

        body = response.json()
        assert body["percent"] == 100
        assert body["rating"] == 5
        assert body["finished_at"] is not None

    def test_cannot_read_past_the_last_page(self, auth, pick):
        response = auth.put(
            "/api/monthly-picks/current/reading",
            {"pages_read": 601},
            content_type="application/json",
        )

        assert response.status_code == 400
        assert "600" in response.json()["detail"]

    def test_readers_list_carries_the_name_and_the_rating(self, auth, member, pick):
        MonthlyReading.objects.create(
            user=member, pick=pick, pages_read=600, finished_at=timezone.now(), rating_halves=8
        )

        body = auth.get("/api/monthly-picks/current/readers").json()

        assert body == [
            {
                "user": {"username": "ana", "full_name": "Ana Ribeiro", "photo": None},
                "rating": 4.0,
                "review": "",
            }
        ]

    def test_reading_requires_login(self, client, pick):
        assert client.get("/api/monthly-picks/current/reading").status_code == 401


class TestRating:
    """The rating is 0-5 in steps of 0.5 on the wire, and twice that in the column.

    Every assertion here is on the contract, not the storage — except where it deliberately
    reaches into `rating_halves` to prove the doubling never escapes the model.
    """

    def rate(self, auth, rating):
        return auth.put(
            "/api/monthly-picks/current/reading",
            {"rating": rating},
            content_type="application/json",
        )

    def test_half_star_round_trips(self, auth, member, pick):
        response = self.rate(auth, 3.5)

        assert response.status_code == 200
        assert response.json()["rating"] == 3.5
        assert MonthlyReading.objects.get(user=member, pick=pick).rating_halves == 7

    def test_whole_star_is_stored_doubled(self, auth, member, pick):
        assert self.rate(auth, 5).json()["rating"] == 5
        assert MonthlyReading.objects.get(user=member, pick=pick).rating_halves == 10

    def test_zero_is_a_rating_of_its_own_and_not_an_erasure(self, auth, member, pick):
        """It used to be the only way to clear a note; TestClearingARating is that way now."""
        self.rate(auth, 4.5)

        assert self.rate(auth, 0).json()["rating"] == 0
        assert MonthlyReading.objects.get(user=member, pick=pick).rating_halves == 0

    def test_null_still_leaves_the_rating_alone(self, auth, member, pick):
        self.rate(auth, 2.5)

        assert self.rate(auth, None).json()["rating"] == 2.5

    @pytest.mark.parametrize("rating", [5.3, 2.3, 0.1, 1.25, 4.99])
    def test_rejects_anything_off_the_half_step(self, auth, member, pick, rating):
        assert self.rate(auth, rating).status_code == 422
        assert not MonthlyReading.objects.filter(rating_halves__isnull=False).exists()

    @pytest.mark.parametrize("rating", [-1, -0.5, 5.5, 6, 11])
    def test_rejects_anything_off_the_scale(self, auth, member, pick, rating):
        assert self.rate(auth, rating).status_code == 422
        assert not MonthlyReading.objects.filter(rating_halves__isnull=False).exists()

    def test_ten_is_out_of_range_on_the_wire(self, auth, pick):
        """The base the column uses is not a value the API accepts — that is the whole point."""
        assert self.rate(auth, 10).status_code == 422

    def test_the_reading_reads_back_in_stars(self, auth, member, pick):
        MonthlyReading.objects.create(user=member, pick=pick, rating_halves=9)

        body = auth.get("/api/monthly-picks/current/reading").json()

        assert body["rating"] == 4.5

    def test_the_profile_history_reads_back_in_stars(self, auth, member, pick):
        MonthlyReading.objects.create(user=member, pick=pick, pages_read=300, rating_halves=1)

        body = auth.get("/api/users/ana").json()

        assert body["readings"][0]["rating"] == 0.5


class TestWhoFinished:
    """`GET /api/monthly-picks/current/readers` — who closed the book *and* said what they thought.

    The filter is two conditions and both matter: `finished_at` is "terminou", and "said
    something" is a note **or** a resenha. A rating of **0 is a rating** — the column is born
    NULL and a zero only ever gets there because a member sent one — and a resenha with no note
    is equally something to say, which is the half this list used to drop.
    """

    def finished(self, user, pick, rating_halves, review=""):
        return MonthlyReading.objects.create(
            user=user,
            pick=pick,
            pages_read=600,
            finished_at=timezone.now(),
            rating_halves=rating_halves,
            review=review,
        )

    def readers(self, client):
        return client.get("/api/monthly-picks/current/readers").json()

    def test_a_reading_in_progress_stays_out(self, auth, member, pick):
        MonthlyReading.objects.create(user=member, pick=pick, pages_read=60, rating_halves=8)

        assert self.readers(auth) == []

    def test_finishing_with_nothing_to_say_stays_out(self, auth, member, pick):
        self.finished(member, pick, rating_halves=None)

        assert self.readers(auth) == []

    def test_a_resenha_without_a_rating_gets_in(self, auth, member, pick):
        """The half the old filter dropped: the longest thing anyone writes, made invisible."""
        self.finished(member, pick, rating_halves=None, review="Demorei, mas valeu.")

        assert self.readers(auth) == [
            {
                "user": {"username": "ana", "full_name": "Ana Ribeiro", "photo": None},
                "rating": None,
                "review": "Demorei, mas valeu.",
            }
        ]

    def test_a_rating_without_a_resenha_still_gets_in(self, auth, member, pick):
        self.finished(member, pick, rating_halves=8)

        assert [(r["rating"], r["review"]) for r in self.readers(auth)] == [(4.0, "")]

    def test_a_rating_of_zero_is_a_rating_and_gets_in(self, auth, member, pick):
        self.finished(member, pick, rating_halves=0)

        assert self.readers(auth) == [
            {
                "user": {"username": "ana", "full_name": "Ana Ribeiro", "photo": None},
                "rating": 0.0,
                "review": "",
            }
        ]

    def test_a_full_rating_gets_in(self, auth, member, pick):
        self.finished(member, pick, rating_halves=10)

        assert [reader["rating"] for reader in self.readers(auth)] == [5.0]

    def test_the_list_is_alphabetical_rather_than_a_race(self, auth, member, other, pick):
        # Bruno finished first and read fastest; the list still opens with Ana (DESIGN.md 9).
        self.finished(other, pick, rating_halves=10)
        self.finished(member, pick, rating_halves=1)

        assert [reader["user"]["full_name"] for reader in self.readers(auth)] == [
            "Ana Ribeiro",
            "Bruno Alves",
        ]

    def test_it_takes_one_query_for_the_whole_list(
        self, auth, member, other, pick, django_assert_num_queries
    ):
        self.finished(member, pick, rating_halves=6)
        self.finished(other, pick, rating_halves=8)

        # Two for the request itself (session row, then the member behind it, which the API's
        # global auth resolves on every call), then one for the pick and one for the readings
        # joined to their users. What this test guards is the last one: it must not become N.
        with django_assert_num_queries(4):
            self.readers(auth)


class TestClearingARating:
    """Erasing a note is its own request now that 0 means zero stars."""

    def put(self, auth, payload):
        return auth.put(
            "/api/monthly-picks/current/reading", payload, content_type="application/json"
        )

    def test_clear_rating_takes_the_column_back_to_null(self, auth, member, pick):
        self.put(auth, {"rating": 4})

        assert self.put(auth, {"clear_rating": True}).json()["rating"] is None
        assert MonthlyReading.objects.get(user=member, pick=pick).rating_halves is None

    def test_zero_is_stored_as_zero_and_not_as_null(self, auth, member, pick):
        assert self.put(auth, {"rating": 0}).json()["rating"] == 0
        assert MonthlyReading.objects.get(user=member, pick=pick).rating_halves == 0

    def test_a_request_that_only_moves_pages_leaves_the_rating_alone(self, auth, member, pick):
        self.put(auth, {"rating": 3.5})

        assert self.put(auth, {"pages_read": 10}).json()["rating"] == 3.5

    def test_grading_and_erasing_in_one_request_is_refused(self, auth, member, pick):
        self.put(auth, {"rating": 2})

        response = self.put(auth, {"rating": 5, "clear_rating": True})

        assert response.status_code == 400
        assert MonthlyReading.objects.get(user=member, pick=pick).rating_halves == 4

    def test_erasing_takes_a_member_off_the_finished_list(self, auth, member, pick):
        self.put(auth, {"pages_read": 600})
        self.put(auth, {"rating": 0})
        assert len(auth.get("/api/monthly-picks/current/readers").json()) == 1

        self.put(auth, {"clear_rating": True})

        assert auth.get("/api/monthly-picks/current/readers").json() == []

    def test_a_resenha_keeps_a_member_on_the_list_after_the_note_is_erased(self, auth, pick):
        self.put(auth, {"pages_read": 600, "rating": 4, "review": "Fiquei pensando dias."})

        self.put(auth, {"clear_rating": True})

        assert [r["review"] for r in auth.get("/api/monthly-picks/current/readers").json()] == [
            "Fiquei pensando dias."
        ]


class TestWritingAResenha:
    """The resenha is a field of the same row, written by the same partial PUT."""

    def put(self, auth, payload):
        return auth.put(
            "/api/monthly-picks/current/reading", payload, content_type="application/json"
        )

    def test_it_is_written_and_read_back(self, auth, pick):
        body = self.put(auth, {"review": "Comecei sem esperar nada."}).json()

        assert body["review"] == "Comecei sem esperar nada."

    def test_a_request_that_only_moves_pages_leaves_the_resenha_alone(self, auth, pick):
        self.put(auth, {"review": "Vale."})

        assert self.put(auth, {"pages_read": 10}).json()["review"] == "Vale."

    def test_an_empty_string_erases_it(self, auth, member, pick):
        """No `clear_review` twin: unlike a 0, an empty resenha is unambiguously no resenha."""
        self.put(auth, {"review": "Escrevi sem querer."})

        assert self.put(auth, {"review": ""}).json()["review"] == ""
        assert MonthlyReading.objects.get(user=member, pick=pick).review == ""

    def test_erasing_it_takes_a_member_off_the_finished_list(self, auth, pick):
        self.put(auth, {"pages_read": 600, "review": "Por ora."})
        assert len(auth.get("/api/monthly-picks/current/readers").json()) == 1

        self.put(auth, {"review": ""})

        assert auth.get("/api/monthly-picks/current/readers").json() == []

    def test_a_resenha_past_the_ceiling_is_refused(self, auth, member, pick):
        response = self.put(auth, {"review": "a" * (REVIEW_MAX_LENGTH + 1)})

        assert response.status_code == 422
        assert not MonthlyReading.objects.filter(user=member, pick=pick).exclude(review="").exists()

    def test_a_resenha_at_the_ceiling_is_accepted(self, auth, pick):
        assert self.put(auth, {"review": "a" * REVIEW_MAX_LENGTH}).status_code == 200


class TestDeclaringTheReadingFinished:
    """`finished` is the declaration the page count could only ever infer.

    It is what makes the resenha reachable at all for a pick whose `Book.pages` is NULL — the
    inference from `pages_read` cannot fire there, so before this field such a reading could
    never be finished by any request the SPA is able to send.
    """

    def put(self, auth, payload):
        return auth.put(
            "/api/monthly-picks/current/reading", payload, content_type="application/json"
        )

    def test_it_finishes_a_book_with_no_page_count(self, auth, book, pick):
        book.pages = None
        book.save()

        assert self.put(auth, {"finished": True}).json()["finished_at"] is not None

    def test_false_un_finishes(self, auth, member, pick):
        self.put(auth, {"pages_read": 600})

        assert self.put(auth, {"finished": False}).json()["finished_at"] is None
        assert MonthlyReading.objects.get(user=member, pick=pick).finished_at is None

    def test_un_finishing_leaves_the_pages_where_they_are(self, auth, pick):
        self.put(auth, {"pages_read": 600})

        assert self.put(auth, {"finished": False}).json()["pages_read"] == 600

    def test_a_second_true_does_not_move_the_stamp(self, auth, pick):
        first = self.put(auth, {"finished": True}).json()["finished_at"]

        assert self.put(auth, {"finished": True}).json()["finished_at"] == first

    def test_it_is_applied_after_the_page_count_so_the_declaration_wins(self, auth, pick):
        body = self.put(auth, {"pages_read": 600, "finished": False}).json()

        assert body["pages_read"] == 600
        assert body["finished_at"] is None

    def test_un_finishing_takes_a_member_off_the_list(self, auth, pick):
        self.put(auth, {"pages_read": 600, "rating": 4})
        assert len(auth.get("/api/monthly-picks/current/readers").json()) == 1

        self.put(auth, {"finished": False})

        assert auth.get("/api/monthly-picks/current/readers").json() == []

    def test_omitting_it_leaves_the_stamp_alone(self, auth, pick):
        self.put(auth, {"pages_read": 600})

        assert self.put(auth, {"pages_read": 300}).json()["finished_at"] is not None
