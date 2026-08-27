import pytest

from books.models import Book, MonthlyReading

pytestmark = pytest.mark.django_db


class TestBooks:
    def test_search_is_public_and_filters(self, client, book):
        Book.objects.create(title="Outro livro", author="Outra pessoa")

        assert len(client.get("/api/books").json()) == 2
        assert len(client.get("/api/books?q=guimarães").json()) == 1

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

    def test_detail_and_404(self, client, book):
        assert client.get(f"/api/books/{book.id}").json()["title"] == book.title
        assert client.get("/api/books/9999").status_code == 404

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
    def test_current_is_404_without_an_active_pick(self, client):
        assert client.get("/api/monthly-picks/current").status_code == 404

    def test_current_returns_the_pick_and_its_book(self, client, pick):
        body = client.get("/api/monthly-picks/current").json()

        assert body["book"]["title"] == pick.book.title
        assert body["blurb"] == pick.blurb

    def test_history_is_public(self, client, pick):
        assert len(client.get("/api/monthly-picks").json()) == 1

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

    def test_readers_list_is_public(self, client, member, pick):
        MonthlyReading.objects.create(user=member, pick=pick, pages_read=60)

        body = client.get("/api/monthly-picks/current/readers").json()

        assert body == [
            {
                "user": {"username": "ana", "full_name": "Ana Ribeiro", "photo": None},
                "pages_read": 60,
                "percent": 10,
                "finished_at": None,
            }
        ]

    def test_reading_requires_login(self, client, pick):
        assert client.get("/api/monthly-picks/current/reading").status_code == 401
