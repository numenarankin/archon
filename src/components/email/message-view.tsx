"use client";

import {
  StarIcon,
  ReplyIcon,
  ReplyAllIcon,
  ForwardIcon,
  Trash2Icon,
  ArchiveIcon,
  PaperclipIcon,
  MailIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Message } from "@/lib/email/mailbox";
import { initials, fullTime } from "@/lib/email/format";

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick}>
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function MessageView({
  message,
  onReply,
  onToggleStar,
}: {
  message: Message | null;
  onReply: (message: Message) => void;
  onToggleStar: (id: string) => void;
}) {
  if (!message) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center gap-3 bg-muted/20 text-center">
        <MailIcon className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Select a message to read it here.
        </p>
      </div>
    );
  }

  const recipients = message.to.map((t) => t.name).join(", ") || "(no recipient)";

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <div className="flex h-14 items-center gap-1 border-b px-4">
        <ActionButton label="Archive">
          <ArchiveIcon className="text-muted-foreground" />
        </ActionButton>
        <ActionButton label="Delete">
          <Trash2Icon className="text-muted-foreground" />
        </ActionButton>
        <ActionButton
          label={message.starred ? "Unstar" : "Star"}
          onClick={() => onToggleStar(message.id)}
        >
          <StarIcon
            className={cn(
              message.starred
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground"
            )}
          />
        </ActionButton>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onReply(message)}
          >
            <ReplyIcon />
            Reply
          </Button>
          <ActionButton label="Reply all">
            <ReplyAllIcon className="text-muted-foreground" />
          </ActionButton>
          <ActionButton label="Forward">
            <ForwardIcon className="text-muted-foreground" />
          </ActionButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-6">
          <h1 className="text-xl font-semibold leading-tight">
            {message.subject || "(no subject)"}
          </h1>

          <div className="mt-4 flex items-start gap-3">
            <Avatar>
              <AvatarFallback>{initials(message.from.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {message.from.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fullTime(message.date)}
                </span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {message.from.email}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                To: {recipients}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/90">
            {message.body.split(/\n{2,}/).map((para, i) => (
              <p key={i} className="whitespace-pre-wrap">
                {para}
              </p>
            ))}
          </div>

          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-8 border-t pt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {message.attachments.length} attachment
                {message.attachments.length > 1 ? "s" : ""}
              </p>
              <ul className="flex flex-wrap gap-2">
                {message.attachments.map((name) => (
                  <li
                    key={name}
                    className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm"
                  >
                    <PaperclipIcon className="size-4 text-muted-foreground" />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
