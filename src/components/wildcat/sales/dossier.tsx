import type { Prospect } from "@/lib/wildcat/sales";

/** Read-only prospect summary shown at the top of the call card's notepad. */
export function Dossier({ prospect }: { prospect: Prospect }) {
  return (
    <div className="shrink-0 border-b px-4 py-3">
      <ul className="mb-3 space-y-1">
        {prospect.highlights.map((h, i) => (
          <li
            key={i}
            className="flex gap-2 text-xs leading-relaxed text-muted-foreground"
          >
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {h}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {prospect.dossier.map((field) => (
          <div key={field.label} className="min-w-0">
            <dt className="text-[10px] font-medium tracking-wide text-muted-foreground/70 uppercase">
              {field.label}
            </dt>
            <dd className="truncate text-xs text-foreground">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
