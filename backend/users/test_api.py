from datetime import date

import pytest
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart

from books.models import Book, Favorite, MonthlyReading

pytestmark = pytest.mark.django_db


class TestMe:
    def test_anonymous_gets_401(self, client):
        # This 401 is the SPA's signal to redirect to /accounts/login/.
        assert client.get("/api/me").status_code == 401

    def test_returns_the_logged_in_member(self, auth):
        response = auth.get("/api/me")

        assert response.status_code == 200
        assert response.json() == {
            "username": "ana",
            "full_name": "Ana Ribeiro",
            "photo": None,
            "quote": "",
            "birth_date": None,
            "favorites": [],
            "is_staff": False,
        }

    def test_is_staff_says_who_may_write_postagens(self, client, organiser):
        client.force_login(organiser)

        assert client.get("/api/me").json()["is_staff"] is True

    def test_is_staff_is_not_public_on_a_profile(self, client, organiser):
        """It belongs to MeOut, not to UserOut — UserProfileOut extends the latter (ADR-15)."""
        body = client.get(f"/api/users/{organiser.username}").json()

        assert "is_staff" not in body

    def test_patch_only_touches_the_fields_sent(self, auth, member):
        response = auth.patch(
            "/api/me", {"quote": "Ler é resistir."}, content_type="application/json"
        )

        assert response.status_code == 200
        member.refresh_from_db()
        assert member.quote == "Ler é resistir."
        assert member.full_name == "Ana Ribeiro"

    def test_patch_can_clear_the_birth_date(self, auth, member):
        member.birth_date = date(2000, 3, 14)
        member.save(update_fields=["birth_date"])

        auth.patch("/api/me", {"birth_date": None}, content_type="application/json")

        member.refresh_from_db()
        assert member.birth_date is None

    def test_photo_upload_is_compressed_to_jpeg(self, auth, member, image_upload):
        payload = encode_multipart(BOUNDARY, {"file": image_upload("foto.png")})

        response = auth.put("/api/me/photo", payload, content_type=MULTIPART_CONTENT)

        assert response.status_code == 200
        member.refresh_from_db()
        assert member.photo.name.endswith(".jpg")
        assert response.json()["photo"] == member.photo.url


class TestFavorites:
    def test_put_replaces_the_whole_shelf_in_order(self, auth, member):
        books = [Book.objects.create(title=t, author="Alguém") for t in ["Um", "Dois", "Três"]]
        Favorite.objects.create(user=member, book=books[0], position=1)

        response = auth.put(
            "/api/me/favorites",
            {
                "favorites": [
                    {"book_id": books[2].id, "position": 1},
                    {"book_id": books[1].id, "position": 2},
                ]
            },
            content_type="application/json",
        )

        assert response.status_code == 200
        assert [b["title"] for b in response.json()] == ["Três", "Dois"]
        assert auth.get("/api/me/favorites").json()[0]["title"] == "Três"

    def test_rejects_repeated_positions(self, auth, book):
        response = auth.put(
            "/api/me/favorites",
            {
                "favorites": [
                    {"book_id": book.id, "position": 1},
                    {"book_id": book.id, "position": 1},
                ]
            },
            content_type="application/json",
        )

        assert response.status_code == 400

    def test_rejects_a_book_that_does_not_exist(self, auth):
        response = auth.put(
            "/api/me/favorites",
            {"favorites": [{"book_id": 9999, "position": 1}]},
            content_type="application/json",
        )

        assert response.status_code == 400
        assert Favorite.objects.count() == 0

    def test_rejects_more_than_four_slots(self, auth):
        books = [Book.objects.create(title=f"L{i}", author="A") for i in range(5)]

        response = auth.put(
            "/api/me/favorites",
            {"favorites": [{"book_id": b.id, "position": i + 1} for i, b in enumerate(books)]},
            content_type="application/json",
        )

        assert response.status_code == 422


class TestUsers:
    def test_search_matches_name_and_username(self, client, member, other):
        assert [u["username"] for u in client.get("/api/users?q=ribeiro").json()] == ["ana"]
        assert [u["username"] for u in client.get("/api/users?q=brun").json()] == ["bruno"]

    def test_public_profile_carries_shelf_and_history(self, client, member, book, pick):
        Favorite.objects.create(user=member, book=book, position=1)
        MonthlyReading.objects.create(user=member, pick=pick, pages_read=300, rating=5)

        body = client.get("/api/users/ana").json()

        assert body["full_name"] == "Ana Ribeiro"
        assert [b["title"] for b in body["favorites"]] == [book.title]
        assert body["readings"][0]["percent"] == 50
        assert body["readings"][0]["pick"]["book"]["title"] == book.title

    def test_unknown_username_is_404(self, client):
        assert client.get("/api/users/ninguem").status_code == 404
