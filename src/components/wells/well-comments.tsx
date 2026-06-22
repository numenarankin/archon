"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { addComment } from "@/lib/wells/actions";
import type { WellComment } from "@/lib/wells/wells";

function relativeTime(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function WellComments({
  wellId,
  comments: initialComments,
  currentUser,
}: {
  wellId: string;
  comments: WellComment[];
  currentUser: { name: string; initials: string };
}) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [, startTransition] = useTransition();

  function handlePost() {
    const body = draft.trim();
    if (!body) {
      return;
    }

    const comment: WellComment = {
      id: `local-${comments.length}-${body.length}`,
      author: currentUser.name,
      initials: currentUser.initials,
      createdAt: new Date().toISOString(),
      body,
    };

    setComments([comment, ...comments]);
    setDraft("");
    startTransition(async () => {
      try {
        await addComment(wellId, body);
      } catch (error) {
        console.error("Failed to post comment", error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-3 rounded-[0.1rem] border p-4">
        <Avatar className="size-8">
          <AvatarFallback>{currentUser.initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                handlePost();
              }
            }}
            placeholder="Add a comment…"
            rows={3}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              ⌘+Enter to post
            </span>
            <Button size="sm" onClick={handlePost} disabled={!draft.trim()}>
              Comment
            </Button>
          </div>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar className="size-8">
                <AvatarFallback>{comment.initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{comment.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(comment.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-foreground/90">
                  {comment.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
