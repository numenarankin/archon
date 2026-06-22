"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  PersonFormFields,
  TYPE_OPTIONS,
  buildPerson,
  formFromPerson,
  type PersonData,
} from "@/components/people/person-form";

/** An existing person being edited, carrying its id alongside the category. */
export interface EditingPerson {
  id: string;
  person: PersonData;
}

export function EditPersonModal({
  editing,
  onClose,
  onSubmit,
}: {
  /** The person to edit, or null when the modal is closed. */
  editing: EditingPerson | null;
  onClose: () => void;
  onSubmit: (id: string, person: PersonData) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  // Re-seed the form from the clicked person each time the modal opens.
  useEffect(() => {
    if (editing) {
      setForm(formFromPerson(editing.person));
    }
  }, [editing]);

  function handleField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    onSubmit(editing.id, buildPerson(editing.person.kind, form, editing.person));
    onClose();
  }

  const typeLabel = editing
    ? TYPE_OPTIONS.find((option) => option.value === editing.person.kind)?.label
    : "";

  return (
    <SwipeUpModal
      open={editing !== null}
      onClose={onClose}
      title="Edit Person"
      description="Update the details, then click Save to apply them."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Person Type</span>
            <div className="flex h-11 items-center rounded-lg border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
              {typeLabel}
            </div>
          </div>

          {editing ? (
            <PersonFormFields
              type={editing.person.kind}
              form={form}
              onField={handleField}
            />
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
