"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  Contractor,
  PeopleCategory,
  RoyaltyOwner,
  ServiceProvider,
} from "@/lib/people/people";

/** A person about to be created or saved, tagged by category. */
export type PersonData =
  | { kind: "contractors"; data: Omit<Contractor, "id"> }
  | { kind: "service-providers"; data: Omit<ServiceProvider, "id"> }
  | { kind: "royalty-owners"; data: Omit<RoyaltyOwner, "id"> };

/** Back-compat alias — used by the add flow. */
export type NewPerson = PersonData;

interface FieldDef {
  key: string;
  label: string;
  type?: "text" | "number" | "email";
}

interface EnumDef {
  key: string;
  label: string;
  options: string[];
}

export interface Option {
  value: string;
  label: string;
}

export const TYPE_OPTIONS: Option[] = [
  { value: "contractors", label: "Contractor" },
  { value: "service-providers", label: "Service Provider" },
  { value: "royalty-owners", label: "Royalty Owner" },
];

const TEXT_FIELDS: Record<PeopleCategory, FieldDef[]> = {
  contractors: [
    { key: "name", label: "Name" },
    { key: "company", label: "Company" },
    { key: "trade", label: "Trade" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email", type: "email" },
  ],
  "service-providers": [
    { key: "company", label: "Company" },
    { key: "service", label: "Service" },
    { key: "contact", label: "Contact" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email", type: "email" },
  ],
  "royalty-owners": [
    { key: "name", label: "Name" },
    { key: "decimalInterest", label: "Decimal Interest", type: "number" },
    { key: "lastPayment", label: "Last Payment (USD)", type: "number" },
    { key: "email", label: "Email", type: "email" },
    { key: "mailingAddress", label: "Mailing Address" },
  ],
};

const ENUM_FIELDS: Record<PeopleCategory, EnumDef[]> = {
  contractors: [
    { key: "status", label: "Status", options: ["Active", "Inactive"] },
  ],
  "service-providers": [
    { key: "status", label: "Status", options: ["Active", "Inactive"] },
  ],
  "royalty-owners": [
    {
      key: "interestType",
      label: "Interest Type",
      options: ["Royalty", "Overriding", "Mineral"],
    },
  ],
};

/** A blank form for the given category, with enums defaulted to their first option. */
export function initialState(type: PeopleCategory): Record<string, string> {
  const state: Record<string, string> = { description: "" };
  for (const field of TEXT_FIELDS[type]) {
    state[field.key] = "";
  }
  for (const field of ENUM_FIELDS[type]) {
    state[field.key] = field.options[0];
  }
  return state;
}

/** Seed a form from an existing person, for the edit flow. */
export function formFromPerson(person: PersonData): Record<string, string> {
  const data = person.data as Record<string, unknown>;
  const state: Record<string, string> = {
    description: data.description == null ? "" : String(data.description),
  };
  for (const field of TEXT_FIELDS[person.kind]) {
    const value = data[field.key];
    state[field.key] = value == null ? "" : String(value);
  }
  for (const field of ENUM_FIELDS[person.kind]) {
    const value = data[field.key];
    state[field.key] = value == null ? field.options[0] : String(value);
  }
  return state;
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Build the typed person payload from raw form state. In edit mode the existing
 * person is passed so non-form fields (e.g. a royalty owner's well links) are
 * preserved rather than reset.
 */
export function buildPerson(
  type: PeopleCategory,
  form: Record<string, string>,
  existing?: PersonData
): PersonData {
  switch (type) {
    case "contractors":
      return {
        kind: "contractors",
        data: {
          name: form.name.trim(),
          company: form.company.trim(),
          trade: form.trade.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          status: form.status as Contractor["status"],
          description: form.description.trim(),
        },
      };
    case "service-providers":
      return {
        kind: "service-providers",
        data: {
          company: form.company.trim(),
          service: form.service.trim(),
          contact: form.contact.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          status: form.status as ServiceProvider["status"],
          description: form.description.trim(),
        },
      };
    case "royalty-owners": {
      const wellIds =
        existing?.kind === "royalty-owners" ? existing.data.wellIds : [];
      return {
        kind: "royalty-owners",
        data: {
          name: form.name.trim(),
          interestType: form.interestType as RoyaltyOwner["interestType"],
          decimalInterest: toNumber(form.decimalInterest),
          lastPayment: toNumber(form.lastPayment),
          email: form.email.trim(),
          mailingAddress: form.mailingAddress.trim(),
          description: form.description.trim(),
          wellIds,
        },
      };
    }
  }
}

/** Horizontal segmented control used for enum fields and the type picker. */
export function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex h-11 items-center gap-1 rounded-lg bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === option.value &&
              "bg-background text-foreground shadow-sm hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** The text + enum fields for a category. Shared by the add and edit modals. */
export function PersonFormFields({
  type,
  form,
  onField,
}: {
  type: PeopleCategory;
  form: Record<string, string>;
  onField: (key: string, value: string) => void;
}) {
  return (
    <>
      {/* Text inputs and the enum control share one grid, so the enum (e.g.
          Status) sits on the same line as the last text field (Email). */}
      <div className="grid grid-cols-2 gap-4">
        {TEXT_FIELDS[type].map((field, index) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{field.label}</span>
            <Input
              type={field.type === "number" ? "number" : field.type ?? "text"}
              inputMode={field.type === "number" ? "decimal" : undefined}
              step={field.type === "number" ? "any" : undefined}
              min={field.type === "number" ? 0 : undefined}
              className="h-11"
              required={index === 0}
              value={form[field.key] ?? ""}
              onChange={(e) => onField(field.key, e.target.value)}
            />
          </label>
        ))}
        {ENUM_FIELDS[type].map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{field.label}</span>
            <Segmented
              value={form[field.key] ?? field.options[0]}
              options={field.options.map((o) => ({ value: o, label: o }))}
              onChange={(value) => onField(field.key, value)}
            />
          </div>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Description</span>
        <textarea
          rows={3}
          value={form.description ?? ""}
          onChange={(e) => onField("description", e.target.value)}
          placeholder="Notes about this person…"
          className="min-h-[5rem] w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </label>
    </>
  );
}
