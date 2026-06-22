"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2Icon,
  CheckIcon,
  UserPlusIcon,
  Trash2Icon,
  SlidersHorizontalIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SwipeUpModal } from "@/components/wells/swipe-up-modal";
import {
  saveProfile,
  inviteMember,
  removeMember,
  setMemberPermissions,
  resendInvite,
  cancelInvite,
} from "@/lib/settings/actions";
import {
  PERMISSION_DEFS,
  PERMISSION_GROUP_ORDER,
  DEFAULT_PERMISSIONS,
  expandPermissions,
  cleanPermissions,
  type PermissionDef,
  type PermissionGroup,
  type PermissionKey,
  type OrgMember,
} from "@/lib/settings/org";
import type { Profile } from "@/lib/settings/profile";

export function OrganizationSection({
  profile,
  members: initialMembers,
  companyAddress,
}: {
  profile: Profile;
  members: OrgMember[];
  companyAddress: string | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CompanyCard
        companyName={profile.companyName}
        companyAddress={companyAddress}
      />
      <MembersSection initialMembers={initialMembers} />
    </div>
  );
}

function CompanyCard({
  companyName,
  companyAddress,
}: {
  companyName: string;
  companyAddress: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(companyName);
  const [savedName, setSavedName] = useState(companyName);
  const [address, setAddress] = useState(companyAddress ?? "");
  const [savedAddress, setSavedAddress] = useState(companyAddress ?? "");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = name !== savedName || address !== savedAddress;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!dirty || pending) return;
    setError(null);
    setJustSaved(false);
    const formData = new FormData();
    formData.set("companyName", name);
    formData.set("companyAddress", address);
    startTransition(async () => {
      try {
        const result = await saveProfile(formData);
        setSavedName(result.companyName);
        setName(result.companyName);
        setSavedAddress(address);
        setJustSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex max-w-md flex-col gap-1.5">
            <span className="text-sm font-medium">Company name</span>
            <Input
              className="h-9"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Energy"
            />
          </label>
          <label className="flex max-w-md flex-col gap-1.5">
            <span className="text-sm font-medium">Company address</span>
            <Input
              className="h-9"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Midland, TX"
            />
          </label>
          <div className="flex items-center gap-3">
            {justSaved && !dirty && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
                Saved
              </span>
            )}
            <Button type="submit" className="h-9" disabled={!dirty || pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

function MembersSection({ initialMembers }: { initialMembers: OrgMember[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  // Re-sync local state when the server sends a fresh list (after router.refresh
  // following a mutation), replacing any optimistic rows. Done during render —
  // React's recommended alternative to a prop→state effect.
  const [syncedMembers, setSyncedMembers] = useState(initialMembers);
  if (syncedMembers !== initialMembers) {
    setSyncedMembers(initialMembers);
    setMembers(initialMembers);
  }

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Permissions to grant the invitee, chosen before sending. Starts empty, so
  // the admin must grant at least one capability before Invite is enabled.
  // Resets after each successful invite.
  const [invitePermissions, setInvitePermissions] =
    useState<PermissionKey[]>(DEFAULT_PERMISSIONS);
  const [error, setError] = useState<string | null>(null);
  // Confirmation after a successful invite/resend. The invite link is emailed
  // to the invitee (it carries the secure token); it is never shown here.
  const [notice, setNotice] = useState<string | null>(null);

  // The invitee gets nothing until at least one capability is granted, so the
  // Invite button stays disabled until the admin sets permissions.
  const grantedPermissions = cleanPermissions(invitePermissions);
  const canInvite = Boolean(email.trim()) && grantedPermissions.length > 0;

  function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    const normalized = email.trim().toLowerCase();
    if (!normalized || grantedPermissions.length === 0) return;
    setError(null);
    setNotice(null);

    const permissions = grantedPermissions;
    const optimistic: OrgMember = {
      id: `temp-${normalized}`,
      name: trimmedName,
      email: normalized,
      isOwner: false,
      permissions,
      status: "invited",
      avatarUrl: null,
    };
    setMembers((prev) => [...prev, optimistic]);
    setName("");
    setEmail("");
    setInvitePermissions(DEFAULT_PERMISSIONS);

    startTransition(async () => {
      try {
        await inviteMember(trimmedName, normalized, permissions);
        setNotice(`Invite sent to ${normalized}.`);
        router.refresh();
      } catch (err) {
        // Roll back the optimistic row and surface the reason.
        setMembers((prev) => prev.filter((m) => m.id !== optimistic.id));
        setError(err instanceof Error ? err.message : "Failed to invite.");
      }
    });
  }

  function handlePermissionsChange(id: string, next: PermissionKey[]) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, permissions: next } : m))
    );
    startTransition(async () => {
      try {
        await setMemberPermissions(id, next);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update.");
        router.refresh();
      }
    });
  }

  function handleRemove(id: string) {
    const prev = members;
    setMembers((cur) => cur.filter((m) => m.id !== id));
    startTransition(async () => {
      try {
        await removeMember(id);
        router.refresh();
      } catch (err) {
        setMembers(prev);
        setError(err instanceof Error ? err.message : "Failed to remove.");
      }
    });
  }

  function handleResend(id: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const { email } = await resendInvite(id);
        setNotice(`Invite re-sent to ${email}.`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to resend.");
      }
    });
  }

  function handleCancelInvite(id: string) {
    const prev = members;
    setMembers((cur) => cur.filter((m) => m.id !== id));
    startTransition(async () => {
      try {
        await cancelInvite(id);
        router.refresh();
      } catch (err) {
        setMembers(prev);
        setError(err instanceof Error ? err.message : "Failed to cancel.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-heading text-xl font-semibold tracking-tight">
        Add new member
      </h2>

      {/* Invite: name + email + permissions */}
      <form
        onSubmit={handleInvite}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Name</span>
          <Input
            className="h-9"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <Input
            type="email"
            className="h-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@company.com"
          />
        </label>
        <div className="flex items-center gap-2">
          <MemberPermissionsModal
            name={name.trim() || email.trim() || "this teammate"}
            permissions={invitePermissions}
            triggerLabel="Set permissions"
            triggerSize="default"
            triggerClassName="h-9"
            onChange={setInvitePermissions}
          />
          <Button type="submit" className="h-9" disabled={!canInvite}>
            <UserPlusIcon />
            Invite
          </Button>
        </div>
      </form>
      {!grantedPermissions.length && (
        <p className="text-sm text-muted-foreground">
          Set permissions before sending the invite.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {notice && (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
          {notice}
        </p>
      )}

      <h2 className="mt-2 font-heading text-xl font-semibold tracking-tight">
        Members
      </h2>

      <div className="overflow-hidden rounded-[0.1rem] border">
        <Table className="text-[0.95rem]">
          <TableHeader className="[&_th]:h-12 [&_th]:font-mono [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  No members yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onPermissionsChange={handlePermissionsChange}
                  onRemove={handleRemove}
                  onResend={handleResend}
                  onCancelInvite={handleCancelInvite}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  onPermissionsChange,
  onRemove,
  onResend,
  onCancelInvite,
}: {
  member: OrgMember;
  onPermissionsChange: (id: string, next: PermissionKey[]) => void;
  onRemove: (id: string) => void;
  onResend: (id: string) => void;
  onCancelInvite: (id: string) => void;
}) {
  const displayName = member.name.trim() || member.email;
  const isOptimistic = member.id.startsWith("temp-");

  return (
    <TableRow className="[&>td]:py-4">
      <TableCell className="font-medium">{displayName}</TableCell>

      <TableCell className="text-muted-foreground">{member.email}</TableCell>

      <TableCell>
        {member.status === "invited" ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            Pending
          </span>
        ) : (
          <span className="text-muted-foreground/50">
            {member.isOwner ? "Owner" : "Active"}
          </span>
        )}
      </TableCell>

      <TableCell>
        {member.isOwner ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <ShieldCheckIcon className="size-4" />
            Full access
          </span>
        ) : (
          <MemberPermissionsModal
            name={displayName}
            permissions={member.permissions}
            disabled={isOptimistic}
            onChange={(next) => onPermissionsChange(member.id, next)}
          />
        )}
      </TableCell>

      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {member.status === "invited" && !member.isOwner ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isOptimistic}
                onClick={() => onResend(member.id)}
                aria-label={`Resend invite to ${displayName}`}
                title="Resend invite"
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <RefreshCwIcon />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={isOptimistic}
                onClick={() => onCancelInvite(member.id)}
                aria-label={`Cancel invite to ${displayName}`}
                title="Cancel invite"
                className="text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                <XIcon />
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={member.isOwner}
              onClick={() => onRemove(member.id)}
              aria-label={`Remove ${displayName}`}
              title={
                member.isOwner
                  ? "The owner can't be removed"
                  : `Remove ${displayName}`
              }
              className="text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** A short summary of what's granted, shown on the sliders trigger button. */
function permissionsLabel(permissions: PermissionKey[]): string {
  if (permissions.includes("admin")) return "Admin";
  const effective = expandPermissions(permissions).filter((k) => k !== "admin");
  const total = PERMISSION_DEFS.filter((d) => d.key !== "admin").length;
  if (effective.length === 0) return "No access";
  if (effective.length >= total) return "Full access";
  return `${effective.length} permission${effective.length === 1 ? "" : "s"}`;
}

/**
 * A sliders-icon trigger that opens a modal of grouped switches, one per
 * grantable capability. `admin` forces every switch on (and locks them); a
 * `manage_*` switch locks its implied `view_*` on. Changes flow out via
 * `onChange`, so the caller decides whether to persist immediately (member
 * rows) or hold locally (the pre-invite grant). Built on the app's SwipeUpModal.
 */
function MemberPermissionsModal({
  name,
  permissions,
  disabled,
  triggerLabel,
  triggerSize = "sm",
  triggerClassName,
  onChange,
}: {
  name: string;
  permissions: PermissionKey[];
  disabled?: boolean;
  /** Override the trigger text (defaults to a summary of what's granted). */
  triggerLabel?: string;
  /** Match the trigger height to a sibling (e.g. "default" beside Invite). */
  triggerSize?: "sm" | "default";
  /** Extra classes for the trigger button (e.g. "h-9" to match inputs). */
  triggerClassName?: string;
  onChange: (next: PermissionKey[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const raw = new Set(permissions);
  const effective = new Set(expandPermissions(permissions));
  const adminOn = effective.has("admin");

  function toggle(key: PermissionKey, checked: boolean) {
    const next = new Set(raw);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(cleanPermissions([...next]));
  }

  // Group the catalog for display, in the configured order.
  const grouped = PERMISSION_GROUP_ORDER.map((group) => ({
    group,
    perms: PERMISSION_DEFS.filter((d) => d.group === group),
  })).filter((g) => g.perms.length > 0);

  const adminDef = PERMISSION_DEFS.find((d) => d.key === "admin");

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={triggerSize}
        className={cn("gap-1.5", triggerClassName)}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontalIcon className="size-3.5 opacity-70" />
        {triggerLabel ?? permissionsLabel(permissions)}
      </Button>

      <SwipeUpModal
        open={open}
        onClose={() => setOpen(false)}
        title="Permissions"
        description={`Choose what ${name} can do in this workspace.`}
        className="max-h-[80vh] max-w-xl"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
          {/* Admin grants everything. */}
          {adminDef && (
            <PermissionToggle
              def={adminDef}
              checked={adminOn}
              disabled={false}
              onChange={(checked) => toggle("admin", checked)}
            />
          )}

          {grouped.map(({ group, perms }) => (
            <PermissionGroupBlock key={group} group={group}>
              {perms.map((def) => {
                // A switch is locked-on when admin is on, or when another
                // granted permission implies it (e.g. manage_* -> view_*).
                const impliedByOther =
                  effective.has(def.key) && !raw.has(def.key);
                const locked = adminOn || impliedByOther;
                return (
                  <PermissionToggle
                    key={def.key}
                    def={def}
                    checked={effective.has(def.key)}
                    disabled={locked}
                    onChange={(checked) => toggle(def.key, checked)}
                  />
                );
              })}
            </PermissionGroupBlock>
          ))}
        </div>

        <div className="flex justify-end border-t px-5 py-4">
          <Button type="button" size="lg" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </SwipeUpModal>
    </>
  );
}

function PermissionGroupBlock({
  group,
  children,
}: {
  group: PermissionGroup;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {group}
      </p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function PermissionToggle({
  def,
  checked,
  disabled,
  onChange,
}: {
  def: PermissionDef;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-3">
      <span className="flex flex-col">
        <span className="text-sm font-medium">{def.label}</span>
        <span className="text-xs text-muted-foreground">{def.description}</span>
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="mt-0.5 shrink-0"
      />
    </label>
  );
}
