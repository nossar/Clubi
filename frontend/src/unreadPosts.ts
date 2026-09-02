import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api/client";
import type { UnreadPosts } from "./api/types";

/**
 * How many postagens the member has not read yet, and the way to say they have.
 *
 * The state behind it is one stamp on the member — `User.posts_seen_at`, compared against
 * `Post.created_at` — not a row per person per post. Two callers share the query and TanStack
 * dedupes them into one request: the badge on the header's balão, and the notice that greets a
 * member who arrives with something waiting.
 *
 * The key is `["posts", "unread"]`, under the same prefix the feed uses, so the blanket
 * `invalidateQueries({ queryKey: ["posts"] })` after writing a post refreshes it too.
 */
export function useUnreadPosts(): number {
  const { data } = useQuery({
    queryKey: ["posts", "unread"],
    queryFn: () => api<UnreadPosts>("/posts/unread"),
  });

  return data?.count ?? 0;
}

/** Opening the feed is what marks them read; `Feed` fires this once on mount. */
export function useMarkPostsSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api<UnreadPosts>("/posts/seen", { method: "POST" }),
    onSuccess: (seen) => {
      queryClient.setQueryData(["posts", "unread"], seen);
    },
  });
}
