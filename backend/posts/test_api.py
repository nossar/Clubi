import pytest

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

    def test_create_returns_the_full_post(self, auth, book):
        response = auth.post(
            "/api/posts",
            {"title": "Sobre o sertão", "body": "Uma leitura.", "book_id": book.id},
            content_type="application/json",
        )

        assert response.status_code == 200
        body = response.json()
        assert body["author"]["username"] == "ana"
        assert body["book"]["title"] == book.title
        assert body["images"] == []

    def test_create_rejects_an_unknown_book(self, auth):
        response = auth.post(
            "/api/posts",
            {"title": "T", "body": "B", "book_id": 9999},
            content_type="application/json",
        )

        assert response.status_code == 400
        assert not Post.objects.exists()

    def test_only_the_author_can_edit(self, client, member, other):
        post = Post.objects.create(author=member, title="Meu", body="...")
        client.force_login(other)

        response = client.patch(
            f"/api/posts/{post.id}", {"title": "Roubado"}, content_type="application/json"
        )

        assert response.status_code == 403
        post.refresh_from_db()
        assert post.title == "Meu"

    def test_author_edits_only_the_fields_sent(self, auth, member, book):
        post = Post.objects.create(author=member, title="Antes", body="Corpo", book=book)

        response = auth.patch(
            f"/api/posts/{post.id}", {"title": "Depois"}, content_type="application/json"
        )

        assert response.status_code == 200
        post.refresh_from_db()
        assert (post.title, post.body, post.book_id) == ("Depois", "Corpo", book.id)

    def test_author_can_detach_the_book(self, auth, member, book):
        post = Post.objects.create(author=member, title="T", body="B", book=book)

        auth.patch(f"/api/posts/{post.id}", {"book_id": None}, content_type="application/json")

        post.refresh_from_db()
        assert post.book_id is None

    def test_delete_is_204_for_the_author_and_403_for_anyone_else(self, client, member, other):
        post = Post.objects.create(author=member, title="T", body="B")

        client.force_login(other)
        assert client.delete(f"/api/posts/{post.id}").status_code == 403

        client.force_login(member)
        assert client.delete(f"/api/posts/{post.id}").status_code == 204
        assert not Post.objects.exists()

    def test_attach_image_compresses_and_numbers_the_slots(self, auth, member, image_upload):
        post = Post.objects.create(author=member, title="T", body="B")

        first = auth.post(f"/api/posts/{post.id}/images", {"file": image_upload("a.png")})
        second = auth.post(f"/api/posts/{post.id}/images", {"file": image_upload("b.png")})

        assert first.status_code == second.status_code == 200
        assert len(second.json()["images"]) == 2
        assert list(post.images.values_list("position", flat=True)) == [1, 2]
        assert post.images.first().file.name.endswith(".jpg")

    def test_a_fifth_image_is_refused(self, auth, member, image_upload):
        post = Post.objects.create(author=member, title="T", body="B")
        for position in range(1, 5):
            PostImage.objects.create(post=post, file=image_upload(), position=position)

        response = auth.post(f"/api/posts/{post.id}/images", {"file": image_upload()})

        assert response.status_code == 400
        assert post.images.count() == 4
