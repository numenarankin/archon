"use client";

import { useState } from "react";
import {
  CalendarPlusIcon,
  CheckIcon,
  LinkIcon,
  MailIcon,
  SendIcon,
  VideoIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  renderTemplate,
  type FollowUpOption,
  type FollowUpType,
  type Prospect,
} from "@/lib/wildcat/sales";
import { scheduleFollowUp } from "@/lib/wildcat/sales-actions";

const TYPE_ICON: Record<FollowUpType, typeof MailIcon> = {
  calendar_invite: CalendarPlusIcon,
  scheduling_link: LinkIcon,
  custom_email: MailIcon,
};

const DURATIONS = ["15 min", "30 min", "45 min", "60 min"];
// Prototype default date — the real UI would seed this from "tomorrow".
const DEFAULT_DATE = "2026-06-26";

export function FollowUpModal({
  open,
  onClose,
  prospect,
  options,
}: {
  open: boolean;
  onClose: () => void;
  prospect: Prospect;
  options: FollowUpOption[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    options[0]?.id ?? null
  );
  const [sent, setSent] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Reset to the first action and clear any confirmation each time the modal
  // opens (adjust-state-during-render pattern, not an effect).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSelectedId(options[0]?.id ?? null);
      setSent(null);
    }
  }

  const selected = options.find((o) => o.id === selectedId) ?? options[0] ?? null;

  return (
    <SwipeUpModal
      open={open}
      onClose={onClose}
      title="Schedule a follow-up"
      description={`${prospect.name} · ${prospect.company}`}
      className="max-w-lg"
    >
      <div className="flex min-h-0 flex-col overflow-y-auto">
        {options.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No follow-up actions are enabled. Turn some on in the Config tab.
          </p>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-4">
            {/* Action picker */}
            <div className="grid grid-cols-3 gap-2">
              {options.map((opt) => {
                const Icon = TYPE_ICON[opt.type];
                const active = opt.id === selected?.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(opt.id);
                      setSent(null);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors",
                      active
                        ? "border-foreground/30 bg-muted/60"
                        : "border-border hover:border-foreground/20 hover:bg-muted/30"
                    )}
                  >
                    <Icon className="size-4 text-foreground" />
                    <span className="text-[11px] font-medium leading-tight text-foreground">
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {selected && (
              <FollowUpDetail
                key={selected.id}
                option={selected}
                prospect={prospect}
                onSend={setSent}
              />
            )}

            {sent && (
              <p className="flex items-start gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <CheckIcon className="mt-0.5 size-3.5 shrink-0" />
                <span className="break-all">{sent}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </SwipeUpModal>
  );
}

function FollowUpDetail({
  option,
  prospect,
  onSend,
}: {
  option: FollowUpOption;
  prospect: Prospect;
  onSend: (message: string) => void;
}) {
  // Calendar invite state.
  const [date, setDate] = useState(DEFAULT_DATE);
  const [time, setTime] = useState("10:00");
  const [durIdx, setDurIdx] = useState(
    Math.max(0, DURATIONS.indexOf(option.duration ?? "30 min"))
  );
  const [addMeet, setAddMeet] = useState(true);
  // Scheduling-link message.
  const [linkMsg, setLinkMsg] = useState(
    `Hi ${prospect.name.split(" ")[0]}, grab whatever time works best:`
  );
  // Custom email state.
  const [subject, setSubject] = useState(
    renderTemplate(option.emailSubject ?? "", prospect)
  );
  const [body, setBody] = useState(
    renderTemplate(option.emailBody ?? "", prospect)
  );
  const [pending, setPending] = useState(false);

  const recipient = prospect.email;

  // Run a follow-up action and surface its confirmation message.
  async function dispatch(input: Parameters<typeof scheduleFollowUp>[0]) {
    setPending(true);
    try {
      const res = await scheduleFollowUp(input);
      onSend(res.message);
    } catch (error) {
      onSend(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  if (option.type === "calendar_invite") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="Date">
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-xs"
            />
          </Labeled>
          <Labeled label="Time">
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="text-xs"
            />
          </Labeled>
        </div>

        <ChipGroup
          label="Length"
          options={DURATIONS}
          active={durIdx}
          onPick={setDurIdx}
        />

        <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
          <div className="flex items-start gap-2">
            <VideoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium text-foreground">
                Add Google Meet link
              </p>
              <p className="text-[11px] text-muted-foreground">
                A Meet link is generated and attached to the invite.
              </p>
            </div>
          </div>
          <Switch checked={addMeet} onCheckedChange={setAddMeet} />
        </div>

        <p className="text-[11px] text-muted-foreground">
          Invite emailed to {recipient}.
        </p>
        <Button
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() =>
            dispatch({
              prospectId: prospect.id,
              type: "calendar_invite",
              toEmail: recipient,
              toName: prospect.name,
              date,
              time,
              durationMinutes: parseInt(DURATIONS[durIdx], 10),
              addMeet,
              title: `Wildcat intro — ${prospect.company}`,
            })
          }
        >
          <SendIcon />
          {pending ? "Sending…" : "Send invite"}
        </Button>
      </div>
    );
  }

  if (option.type === "scheduling_link") {
    return (
      <div className="space-y-3">
        <Labeled label="Scheduling link">
          <Input readOnly value={option.schedulingUrl ?? ""} className="text-xs" />
        </Labeled>
        <Labeled label="Message (optional)">
          <textarea
            value={linkMsg}
            onChange={(e) => setLinkMsg(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring"
          />
        </Labeled>
        <Button
          size="sm"
          className="w-full"
          disabled={pending}
          onClick={() =>
            dispatch({
              prospectId: prospect.id,
              type: "scheduling_link",
              toEmail: recipient,
              toName: prospect.name,
              schedulingUrl: option.schedulingUrl,
              subject: "Let's find a time",
              body: linkMsg,
            })
          }
        >
          <SendIcon />
          {pending ? "Sending…" : "Send link"}
        </Button>
      </div>
    );
  }

  // custom_email
  return (
    <div className="space-y-3">
      <Labeled label="To">
        <Input readOnly value={recipient} className="text-xs" />
      </Labeled>
      <Labeled label="Subject">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="text-xs"
        />
      </Labeled>
      <Labeled label="Body">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full resize-none rounded-lg border bg-transparent px-2.5 py-1.5 text-xs leading-relaxed outline-none focus-visible:border-ring"
        />
      </Labeled>
      <Button
        size="sm"
        className="w-full"
        disabled={pending}
        onClick={() =>
          dispatch({
            prospectId: prospect.id,
            type: "custom_email",
            toEmail: recipient,
            toName: prospect.name,
            subject,
            body,
          })
        }
      >
        <SendIcon />
        {pending ? "Sending…" : "Send email"}
      </Button>
    </div>
  );
}

function ChipGroup({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: string[];
  active: number;
  onPick: (i: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(i)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
              active === i
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Labeled({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
