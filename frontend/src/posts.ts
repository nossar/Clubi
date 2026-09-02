import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "./api/client";
import type { Me, Post, PostPatch } from "./api/types";

/**
 * Who may edit or erase a postagem, and how it is erased. Shared by the two places that offer it:
 * the card on the feed and the postagem's own page.
 *
 * The rule lives here rather than being written twice because it is not obvious enough to
 * duplicate: **author *and* staff**, mirroring `_own_post` in `posts/api.py`, which calls
 * `_staff_only` before it compares authorship. A member who was demoted keeps their old postagens
 * on screen and loses the controls — which is what the API would answer anyway, only without the
 * failed request.
 */
export function canManagePost(post: Post, me: Me): boolean {
  return me.is_staff && post.author.username === me.username;
}

/**
 * `DELETE /api/posts/:id`. Answers 204 with no body — `api<T>()` returns undefined for that
 * status rather than throwing on the empty response.
 *
 * Invalidating the whole `["posts"]` prefix is deliberate: it covers every page of the feed and
 * the unread badge under `["posts", "unread"]`, so a postagem deleted from page 2 cannot linger
 * in the cache of page 1. `onDeleted` is where the caller says what to do afterwards — the feed
 * has nothing to do (the list simply refetches without the row), the postagem's own page has to
 * leave, since the address it is sitting on has just stopped existing.
 */
export function useDeletePost(postId: number, onDeleted?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api<undefined>(`/posts/${postId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onDeleted?.();
    },
  });
}

/**
 * `PATCH /api/posts/:id`. Shared by `PostEditForm`'s two hosts, so the cache bookkeeping is
 * written once: the postagem's own key takes the response directly (it *is* the new post), and
 * the `["posts"]` prefix is invalidated because an edited title has to change on every page of
 * the feed that might be holding it.
 */
export function useUpdatePost(postId: number, onSaved?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: PostPatch) =>
      api<Post>(`/posts/${postId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["post", postId], updated);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onSaved?.();
    },
  });
}

/**
 * The payload for an edit: only the fields that actually changed.
 *
 * This is not an optimisation, it is the contract. `update_post` ignores a `null` in `title` and
 * `body` and accepts one only in `book_id`, so an untouched field must be **absent** from the
 * request rather than round-trip as null. An empty object means nothing changed and no request is
 * worth making — the callers read it that way and simply close the form.
 */
export function postEditPayload(
  post: Post,
  next: { title: string; body: string; bookId: number | null },
): PostPatch {
  const payload: PostPatch = {};
  if (next.title !== post.title) payload.title = next.title;
  if (next.body !== post.body) payload.body = next.body;
  if (next.bookId !== (post.book?.id ?? null)) payload.book_id = next.bookId;
  return payload;
}
