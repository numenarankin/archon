"use client";

import { type Dispatch, type SetStateAction } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  SCRIPT_TOKENS,
  type FollowUpOption,
  type Objection,
  type SalesConfig,
} from "@/lib/wildcat/sales";

const TYPE_LABELS: Record<FollowUpOption["type"], string> = {
  calendar_invite: "Calendar invite",
  scheduling_link: "Scheduling link",
  custom_email: "Custom email",
};

/**
 * The Config tab: the rep's standing setup that the Desk reads — opening script
 * template, objection library, and the follow-up actions available mid-call.
 */
export function ConfigPanel({
  config,
  onChange,
}: {
  config: SalesConfig;
  onChange: Dispatch<SetStateAction<SalesConfig>>;
}) {
  function setScript(openingScript: string) {
    onChange((c) => ({ ...c, openingScript }));
  }

  function updateObjection(id: string, patch: Partial<Objection>) {
    onChange((c) => ({
      ...c,
      objections: c.objections.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }

  function addObjection() {
    onChange((c) => ({
      ...c,
      objections: [
        ...c.objections,
        { id: `o-${Date.now()}`, trigger: "", response: "" },
      ],
    }));
  }

  function removeObjection(id: string) {
    onChange((c) => ({
      ...c,
      objections: c.objections.filter((o) => o.id !== id),
    }));
  }

  function updateFollowUp(id: string, patch: Partial<FollowUpOption>) {
    onChange((c) => ({
      ...c,
      followUps: c.followUps.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
        {/* Opening script */}
        <Section
          title="Opening script"
          description="Shown on the left of the call card. Use tokens to personalize each call."
        >
          <textarea
            value={config.openingScript}
            onChange={(e) => setScript(e.target.value)}
            rows={5}
            className="w-full resize-none rounded-lg border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Tokens:</span>
            {SCRIPT_TOKENS.map((t) => (
              <code
                key={t}
                className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground"
              >
                {t}
              </code>
            ))}
          </div>
        </Section>

        {/* Objections */}
        <Section
          title="Objections"
          description="Quick-reference rebuttals, expandable on the call card."
          action={
            <Button variant="outline" size="sm" onClick={addObjection}>
              <PlusIcon />
              Add
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            {config.objections.map((o) => (
              <div key={o.id} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    value={o.trigger}
                    placeholder="What they say…"
                    onChange={(e) =>
                      updateObjection(o.id, { trigger: e.target.value })
                    }
                    className="h-7 text-xs font-medium"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove objection"
                    onClick={() => removeObjection(o.id)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                <textarea
                  value={o.response}
                  placeholder="How to respond…"
                  onChange={(e) =>
                    updateObjection(o.id, { response: e.target.value })
                  }
                  rows={2}
                  className="w-full resize-none rounded-md border bg-transparent px-2.5 py-1.5 text-xs leading-relaxed outline-none focus-visible:border-ring"
                />
              </div>
            ))}
            {config.objections.length === 0 && (
              <p className="text-xs text-muted-foreground">No objections yet.</p>
            )}
          </div>
        </Section>

        {/* Follow-up options */}
        <Section
          title="Follow-up actions"
          description="What the rep can fire from the follow-up modal during a call."
        >
          <div className="flex flex-col gap-3">
            {config.followUps.map((f) => (
              <div key={f.id} className="rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={(v) => updateFollowUp(f.id, { enabled: v })}
                  />
                  <div className="min-w-0 flex-1">
                    <Input
                      value={f.label}
                      onChange={(e) =>
                        updateFollowUp(f.id, { label: e.target.value })
                      }
                      className="h-7 text-xs font-medium"
                    />
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {TYPE_LABELS[f.type]}
                  </span>
                </div>

                {f.enabled && (
                  <div className="mt-3 space-y-2 pl-12">
                    {f.type === "calendar_invite" && (
                      <ConfigField label="Default duration">
                        <Input
                          value={f.duration ?? ""}
                          onChange={(e) =>
                            updateFollowUp(f.id, { duration: e.target.value })
                          }
                          className="h-7 text-xs"
                        />
                      </ConfigField>
                    )}
                    {f.type === "scheduling_link" && (
                      <ConfigField label="Booking URL">
                        <Input
                          value={f.schedulingUrl ?? ""}
                          onChange={(e) =>
                            updateFollowUp(f.id, { schedulingUrl: e.target.value })
                          }
                          className="h-7 text-xs"
                        />
                      </ConfigField>
                    )}
                    {f.type === "custom_email" && (
                      <>
                        <ConfigField label="Subject">
                          <Input
                            value={f.emailSubject ?? ""}
                            onChange={(e) =>
                              updateFollowUp(f.id, { emailSubject: e.target.value })
                            }
                            className="h-7 text-xs"
                          />
                        </ConfigField>
                        <ConfigField label="Body">
                          <textarea
                            value={f.emailBody ?? ""}
                            onChange={(e) =>
                              updateFollowUp(f.id, { emailBody: e.target.value })
                            }
                            rows={4}
                            className="w-full resize-none rounded-md border bg-transparent px-2.5 py-1.5 text-xs leading-relaxed outline-none focus-visible:border-ring"
                          />
                        </ConfigField>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ConfigField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
