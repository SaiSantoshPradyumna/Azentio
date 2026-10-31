"use client";

import { Status, usePost } from "@/components/moderation-form";

/**
 * Section 14&rsquo;s moderator half: a product owner writes the client-facing text and a moderator stands
 * behind it. Approval is the approved_by column naming this account, which is why the button calls the
 * moderation.review endpoint and not the one that writes the text.
 */
export function IdeaUpdateApproval({ ideaId, updateId, busy }: { ideaId: string; updateId: string; busy?: boolean }) {
  const { post, feedback } = usePost(`/api/ideas/${ideaId}`);

  return (
    <div className="space-y-sm">
      <button
        type="button"
        className="btn-primary text-sm"
        disabled={feedback.busy || busy === true}
        onClick={() => post("public-update/approve", { update_id: updateId })}
        data-testid="approve-idea-update"
      >
        {feedback.busy ? "Working…" : "Approve for clients"}
      </button>
      <Status message={feedback.message} />
    </div>
  );
}
