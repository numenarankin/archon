"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";

export interface EventFormValues {
  title: string;
  /** Date as an ISO `YYYY-MM-DD` string. */
  date: string;
  /** True for all-day items; `start`/`end` are ignored when true. */
  allDay: boolean;
  /** Start time as a 24-hour `HH:MM` string ("" when all-day). */
  start: string;
  /** End time as a 24-hour `HH:MM` string ("" when all-day). */
  end: string;
  location: string;
  people: string[];
  description: string;
}

type FormState = {
  title: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  location: string;
  people: string;
  description: string;
};

const EMPTY: FormState = {
  title: "",
  date: "",
  allDay: true,
  start: "",
  end: "",
  location: "",
  people: "",
  description: "",
};

function toFormState(initial?: EventFormValues): FormState {
  if (!initial) {
    return EMPTY;
  }
  return {
    title: initial.title,
    date: initial.date,
    allDay: initial.allDay,
    start: initial.start,
    end: initial.end,
    location: initial.location,
    people: initial.people.join(", "),
    description: initial.description,
  };
}

export function EventModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: EventFormValues;
  onClose: () => void;
  onSubmit: (values: EventFormValues) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [wasOpen, setWasOpen] = useState(false);

  // Seed the form from the event being edited (or a clean form) when the modal
  // opens. Adjusting state during render on the open transition avoids an
  // effect + cascading render.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(toFormState(initial));
    }
  }

  function handleField(
    key: Exclude<keyof FormState, "allDay">,
    value: string
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      title: form.title.trim(),
      date: form.date,
      allDay: form.allDay,
      start: form.allDay ? "" : form.start,
      end: form.allDay ? "" : form.end,
      location: form.location.trim(),
      people: form.people
        .split(",")
        .map((person) => person.trim())
        .filter(Boolean),
      description: form.description.trim(),
    });
    onClose();
  }

  const isEdit = mode === "edit";

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Event" : "New Event"}
      description={
        isEdit
          ? "Update this event, then save."
          : "Add an event to the operations calendar."
      }
      className="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Title</span>
            <Input
              className="h-11"
              required
              autoFocus
              value={form.title}
              onChange={(e) => handleField("title", e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Date</span>
              <Input
                type="date"
                className="h-11"
                required
                value={form.date}
                onChange={(e) => handleField("date", e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">All day</span>
              <div className="flex h-11 items-center">
                <input
                  type="checkbox"
                  className="size-4 accent-foreground"
                  checked={form.allDay}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, allDay: e.target.checked }))
                  }
                />
              </div>
            </label>
          </div>

          {!form.allDay && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Start</span>
                <Input
                  type="time"
                  className="h-11"
                  value={form.start}
                  onChange={(e) => handleField("start", e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">End</span>
                <Input
                  type="time"
                  className="h-11"
                  value={form.end}
                  onChange={(e) => handleField("end", e.target.value)}
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Location</span>
            <Input
              className="h-11"
              value={form.location}
              onChange={(e) => handleField("location", e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">People</span>
            <Input
              className="h-11"
              placeholder="Comma-separated names"
              value={form.people}
              onChange={(e) => handleField("people", e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Description</span>
            <textarea
              rows={4}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              value={form.description}
              onChange={(e) => handleField("description", e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="lg">
            {isEdit ? "Save" : "Add Event"}
          </Button>
        </div>
      </form>
    </SwipeUpModal>
  );
}
