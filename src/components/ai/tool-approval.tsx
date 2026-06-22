"use client";

import { CheckIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UIMessage } from "ai";

export interface PendingApproval {
  id: string;
  name: string;
  input: unknown;
}

/** Write-tool calls in a message awaiting the user's approve/deny. */
export function pendingApprovals(message: UIMessage): PendingApproval[] {
  const out: PendingApproval[] = [];
  for (const part of message.parts) {
    const p = part as {
      type: string;
      state?: string;
      input?: unknown;
      approval?: { id: string };
    };
    if (
      p.type.startsWith("tool-") &&
      p.state === "approval-requested" &&
      p.approval
    ) {
      out.push({
        id: p.approval.id,
        name: p.type.slice("tool-".length),
        input: p.input,
      });
    }
  }
  return out;
}

/** Approve / deny card for a single pending write-tool call. */
export function ApprovalCard({
  request,
  onApprove,
  onDeny,
}: {
  request: PendingApproval;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="ty-body-2 text-primary-text">
        Archon wants to run{" "}
        <span className="font-mono text-xs">{request.name}</span>. Approve?
      </p>
      {request.input != null && (
        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-background-subtle p-2 text-xs text-tertiary-text">
          {JSON.stringify(request.input, null, 2)}
        </pre>
      )}
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" onClick={onApprove}>
          <CheckIcon />
          Approve
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDeny}>
          <XIcon />
          Deny
        </Button>
      </div>
    </div>
  );
}
