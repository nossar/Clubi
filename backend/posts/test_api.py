import pytest

from posts import api as posts_api
from posts.models import Post, PostImage

pytestmark = pytest.mark.django_db


class TestPosts:
    def test_feed_is_public_and_paginated(self, client, member):
        for i in range(3):
            Post.objects.create(author=member, title=f"Post {i}", body="...")

        body = client.get("/api/posts?page=1&size=2").json()

        assert body["total"] == 3
        assert body["page"] == 1
        assert body["has_next"] is True
        assert len(body["items"]) == 2

    def test_feed_hides_unpublished_posts(self, client, member):
        Post.objects.create(author=member, title="Rascunho", body="...", published=False)

        assert client.get("/api/posts").json()["total"] == 0

    def test_create_returns_the_full_post(self, staff_auth, book):
        response = staff_auth.post(
            "/api/posts",
            {"title": "Sobre o sertão", "body": "Uma leitura.", "book_id": book.id},
            content_type="application/json",
        )

        assert response.status_code == 200
        body = response.json()
        assert body["author"]["username"] == "carla"
        assert body["book"]["title"] == book.title
        assert body["images"] == []

    def test_create_rejects_an_unknown_book(self, staff_auth):
        response = staff_auth.post(
            "/api/posts",
            {"title": "T", "body": "B", "book_id": 9999},
            content_type="application/json",
        )

        assert response.status_code == 400
        assert not Post.objects.exists()

    def test_only_the_author_can_edit(self, client, organiser, co_organiser):
        # Both are staff, so what this proves is authorship — not the staff check above it.
        post = Post.objects.create(author=organiser, title="Meu", body="...")
        client.force_login(co_organiser)

        response = client.patch(
            f"/api/posts/{post.id}", {"title": "Roubado"}, content_type="application/json"
        )

        assert response.status_code == 403
        post.refresh_from_db()
        assert post.title == "Meu"

    def test_author_edits_only_the_fields_sent(self, staff_auth, organiser, book):
        post = Post.objects.create(author=organiser, title="Antes", body="Corpo", book=book)

        response = staff_auth.patch(
            f"/api/posts/{post.id}", {"title": "Depois"}, content_type="application/json"
        )

        assert response.status_code == 200
        post.refresh_from_db()
        assert (post.title, post.body, post.book_id) == ("Depois", "Corpo", book.id)

    def test_patch_rejects_a_title_longer_than_the_column(self, staff_auth, organiser):
        """PostIn goes through PatchDict here, which drops a limit written as a default."""
        post = Post.objects.create(author=organiser, title="Antes", body="Corpo")

        response = staff_auth.patch(
            f"/api/posts/{post.id}", {"title": "a" * 141}, content_type="application/json"
        )

        assert response.status_code == 422
        post.refresh_from_db()
        assert post.title == "Antes"

    def test_create_still_rejects_a_title_longer_than_the_column(self, staff_auth):
        response = staff_auth.post(
            "/api/posts", {"title": "a" * 141, "body": "B"}, content_type="application/json"
        )

        assert response.status_code == 422

    def test_author_can_detach_the_book(self, staff_auth, organiser, book):
        post = Post.objects.create(author=organiser, title="T", body="B", book=book)

        staff_auth.patch(
            f"/api/posts/{post.id}", {"book_id": None}, content_type="application/json"
        )

        post.refresh_from_db()
        assert post.book_id is None

    def test_delete_is_204_for_the_author_and_403_for_anyone_else(
        self, client, organiser, co_organiser
    ):
        post = Post.objects.create(author=organiser, title="T", body="B")

        client.force_login(co_organiser)
        assert client.delete(f"/api/posts/{post.id}").status_code == 403

        client.force_login(organiser)
        assert client.delete(f"/api/posts/{post.id}").status_code == 204
        assert not Post.objects.exists()

    def test_attach_image_compresses_and_numbers_the_slots(
        self, staff_auth, organiser, image_upload
    ):
        post = Post.objects.create(author=organiser, title="T", body="B")

        first = staff_auth.post(f"/api/posts/{post.id}/images", {"file": image_upload("a.png")})
        second = staff_auth.post(f"/api/posts/{post.id}/images", {"file": image_upload("b.png")})

        assert first.status_code == second.status_code == 200
        assert len(second.json()["images"]) == 2
        assert list(post.images.values_list("position", flat=True)) == [1, 2]
        assert post.images.first().file.name.endswith(".jpg")

    def test_reuses_the_slot_freed_by_an_admin_deletion(self, staff_auth, organiser, image_upload):
        post = Post.objects.create(author=organiser, title="T", body="B")
        for position in (1, 2, 3, 4):
            PostImage.objects.create(post=post, file=image_upload(), position=position)
        # The founder removes the second image through the admin inline, leaving a
        # hole. Counting rows would say "room for one more" and then aim past slot 4.
        post.images.filter(position=2).delete()

        response = staff_auth.post(f"/api/posts/{post.id}/images", {"file": image_upload()})

        assert response.status_code == 200
        assert sorted(post.images.values_list("position", flat=True)) == [1, 2, 3, 4]

    def test_losing_the_race_for_a_slot_is_409_rather_than_500(
        self, staff_auth, organiser, image_upload, monkeypatch
    ):
        post = Post.objects.create(author=organiser, title="T", body="B")
        original = posts_api.compress_image

        def take_the_slot_first(upload, *args, **kwargs):
            # compress_image runs between picking the free slot and inserting, so
            # this stands in for a concurrent upload committing in that window.
            PostImage.objects.create(post=post, file=image_upload(), position=1)
            return original(upload, *args, **kwargs)

        monkeypatch.setattr(posts_api, "compress_image", take_the_slot_first)

        response = staff_auth.post(f"/api/posts/{post.id}/images", {"file": image_upload()})

        assert response.status_code == 409
        assert post.images.count() == 1

    def test_a_fifth_image_is_refused(self, staff_auth, organiser, image_upload):
        post = Post.objects.create(author=organiser, title="T", body="B")
        for position in range(1, 5):
            PostImage.objects.create(post=post, file=image_upload(), position=position)

        response = staff_auth.post(f"/api/posts/{post.id}/images", {"file": image_upload()})

        assert response.status_code == 400
        assert post.images.count() == 4


class TestOnlyStaffWrites:
    """Reading is the whole club's; writing is the organisation's.

    The four write endpoints refuse a plain member before they look at anything else — a
    non-author gets the same 403 either way, but a *non-staff author* is only possible for a
    member who was demoted, and they must stop being able to edit too.
    """

    def test_a_plain_member_cannot_create(self, auth):
        response = auth.post(
            "/api/posts", {"title": "T", "body": "B"}, content_type="application/json"
        )

        assert response.status_code == 403
        assert "organização" in response.json()["detail"]
        assert not Post.objects.exists()

    def test_a_demoted_author_cannot_edit_their_own_post(self, auth, member):
        post = Post.objects.create(author=member, title="Antes", body="B")

        response = auth.patch(
            f"/api/posts/{post.id}", {"title": "Depois"}, content_type="application/json"
        )

        assert response.status_code == 403
        post.refresh_from_db()
        assert post.title == "Antes"

    def test_a_demoted_author_cannot_delete_their_own_post(self, auth, member):
        post = Post.objects.create(author=member, title="T", body="B")

        assert auth.delete(f"/api/posts/{post.id}").status_code == 403
        assert Post.objects.filter(pk=post.id).exists()

    def test_a_plain_member_cannot_attach_an_image(self, auth, member, image_upload):
        post = Post.objects.create(author=member, title="T", body="B")

        response = auth.post(f"/api/posts/{post.id}/images", {"file": image_upload()})

        assert response.status_code == 403
        assert post.images.count() == 0

    def test_a_plain_member_still_reads_everything(self, client, member, organiser):
        post = Post.objects.create(author=organiser, title="T", body="B")
        client.force_login(member)

        assert client.get("/api/posts").json()["total"] == 1
        assert client.get(f"/api/posts/{post.id}").status_code == 200


class TestUnreadPosts:
    """One stamp on the member (`User.posts_seen_at`), counted against `Post.created_at`."""

    def test_a_member_who_never_opened_the_feed_has_everything_unread(self, auth, organiser):
        for i in range(3):
            Post.objects.create(author=organiser, title=f"Post {i}", body="...")

        assert auth.get("/api/posts/unread").json() == {"count": 3}

    def test_your_own_postagens_never_count(self, staff_auth, organiser):
        Post.objects.create(author=organiser, title="Minha", body="...")

        assert staff_auth.get("/api/posts/unread").json() == {"count": 0}

    def test_unpublished_postagens_never_count(self, auth, organiser):
        Post.objects.create(author=organiser, title="Rascunho", body="...", published=False)

        assert auth.get("/api/posts/unread").json() == {"count": 0}

    def test_opening_the_feed_clears_the_count(self, auth, member, organiser):
        Post.objects.create(author=organiser, title="Post", body="...")

        assert auth.post("/api/posts/seen").json() == {"count": 0}
        assert auth.get("/api/posts/unread").json() == {"count": 0}
        member.refresh_from_db()
        assert member.posts_seen_at is not None

    def test_only_what_came_after_the_last_visit_counts(self, auth, member, organiser):
        Post.objects.create(author=organiser, title="Antiga", body="...")
        auth.post("/api/posts/seen")

        Post.objects.create(author=organiser, title="Nova", body="...")

        assert auth.get("/api/posts/unread").json() == {"count": 1}

    def test_both_routes_need_a_session(self, client):
        assert client.get("/api/posts/unread").status_code == 401
        assert client.post("/api/posts/seen").status_code == 401

    def test_unread_is_not_read_as_a_post_id(self, client, member):
        """The int: converter is what keeps /posts/unread off the /posts/{id} route."""
        assert client.get("/api/posts/unread").status_code == 401  # not 404
