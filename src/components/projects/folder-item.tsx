import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slug";
import type { ProjectFolder } from "@/lib/projects/folders";

interface FolderItemProps {
  folder: ProjectFolder;
}

export function FolderItem({ folder }: FolderItemProps) {
  return (
    <Link
      href={`/projects/${slugify(folder.name)}`}
      className={cn(
        "group flex w-full flex-col items-start gap-3 rounded-xl p-3 text-left",
        "transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      )}
    >
      <Image
        src="/folders-fill.svg"
        alt=""
        width={128}
        height={128}
        className="size-32 transition-transform group-hover:scale-105"
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-medium text-foreground">
          {folder.name}
        </span>
        {folder.itemCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            {folder.itemCount} {folder.itemCount === 1 ? "item" : "items"}
          </span>
        )}
      </div>
    </Link>
  );
}
