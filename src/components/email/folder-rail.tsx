"use client";

import {
  InboxIcon,
  StarIcon,
  SendIcon,
  FileIcon,
  ArchiveIcon,
  Trash2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PenSquareIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAIL_FOLDERS, type FolderId } from "@/lib/email/mailbox";

const FOLDER_ICONS: Record<FolderId, LucideIcon> = {
  inbox: InboxIcon,
  starred: StarIcon,
  sent: SendIcon,
  drafts: FileIcon,
  archive: ArchiveIcon,
  trash: Trash2Icon,
};

export function FolderRail({
  active,
  onSelect,
  counts,
  collapsed,
  onToggleCollapsed,
  onCompose,
}: {
  active: FolderId;
  onSelect: (folder: FolderId) => void;
  counts: Record<FolderId, number>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCompose: () => void;
}) {
  return (
    <nav
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200",
        collapsed ? "w-14" : "w-56"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b px-2",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed && (
          <span className="px-2 text-sm font-semibold">Mail</span>
        )}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={onToggleCollapsed}
              >
                {collapsed ? (
                  <PanelLeftOpenIcon className="text-muted-foreground" />
                ) : (
                  <PanelLeftCloseIcon className="text-muted-foreground" />
                )}
              </Button>
            }
          />
          <TooltipContent side="right">
            {collapsed ? "Expand" : "Collapse"}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon"
                  aria-label="Compose"
                  className="w-full"
                  onClick={onCompose}
                >
                  <PenSquareIcon />
                </Button>
              }
            />
            <TooltipContent side="right">Compose</TooltipContent>
          </Tooltip>
        ) : (
          <Button className="w-full justify-start gap-2" onClick={onCompose}>
            <PenSquareIcon />
            Compose
          </Button>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {MAIL_FOLDERS.map((folder) => {
          const Icon = FOLDER_ICONS[folder.id];
          const isActive = folder.id === active;
          const count = counts[folder.id];
          const button = (
            <button
              type="button"
              onClick={() => onSelect(folder.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-9 w-full items-center rounded-lg text-sm transition-colors",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                isActive
                  ? "bg-muted font-medium text-foreground"
                  : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="flex-1 text-left">{folder.label}</span>}
              {!collapsed && count > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {count}
                </span>
              )}
            </button>
          );

          return (
            <li key={folder.id}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger render={button} />
                  <TooltipContent side="right">
                    {folder.label}
                    {count > 0 ? ` (${count})` : ""}
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
