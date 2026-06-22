"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  PersonFormFields,
  Segmented,
  TYPE_OPTIONS,
  buildPerson,
  initialState,
  type NewPerson,
} from "@/components/people/person-form";
import type { PeopleCategory } from "@/lib/people/people";

export type { NewPerson };

export function AddPersonModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (person: NewPerson) => void;
}) {
  const [type, setType] = useState<PeopleCategory>("contractors");
  const [form, setForm] = useState<Record<string, string>>(() =>
    initialState("contractors")
  );

  // Reset to a clean Contractor form each time the modal opens.
  useEffect(() => {
    if (open) {
      setType("contractors");
      setForm(initialState("contractors"));
    }
  }, [open]);

  function handleTypeChange(next: PeopleCategory) {
    setType(next);
    setForm(initialState(next));
  }

  function handleField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(buildPerson(type, form));
    onClose();
  }

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title="Add Person"
      description="Choose a person type, then fill in the details."
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Person Type</span>
            <Segmented
              value={type}
              options={TYPE_OPTIONS}
              onChange={(value) => handleTypeChange(value as PeopleCategory)}
            />
          </div>

          <PersonFormFields type={type} form={form} onField={handleField} />
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            Add Person
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
