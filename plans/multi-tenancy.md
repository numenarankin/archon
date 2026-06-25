# Multi-Tenant Data Isolation Plan

## Goal

Make the app safe for multiple users. No user (and no user's AI agent) may read or
write another user's data. Built **per-user now, org-ready** so that workspace
sharing can be turned on later without a schema rewrite. Each table is classified
as user-private, org-shared, or entitlement-gated reference data.

## Current state (why this is needed)

The live schema is explicitly single-tenant. The init migration says it plainly:

> "Any authenticated account has full access; Row Level Security is enabled on
> every table with a single `to authenticated` policy."

Every table has `... for all to authenticated using (true) with check (true)`.
Any logged-in user reads and writes everything. Concretely:

- **AI agent leaks across users today.** `match_agent_memory()` returns *all*
  users' memories; document/chat/file tools fall back to global scope.
- Ownership columns mostly exist but are unused (`files.uploaded_by`,
  `conversations.owner_id`, `agent_memory.user_id`).
- `profile` is a **singleton** — one row for "the" user. Must become per-user.
- Some **dead legacy code** references orgs / `current_org_id()` / `transactions`
  that don't exist in the live schema (half-migrated). To be reconciled.

### Live DB verification (confirmed against the hosted project)

Introspected the live project directly. Findings:

- **No drift**: live tables/columns/RPCs match the migration files. Existing
  ownership columns are the unused trio only: `files.uploaded_by`,
  `conversations.owner_id`, `agent_memory.user_id`. No tenant/owner/org column
  exists yet. `archon_skills.enabled` already exists. `profile` and
  `integration_settings` are still singletons.
- **Every table** has RLS enabled and exactly one policy `<table>_authenticated`
  = `for all to authenticated using (true) with check (true)`. Verified via
  `pg_policies`. No hidden owner predicates — nothing to reconcile.
- **`rls_auto_enable`** is an *event trigger* (SECURITY DEFINER) that runs
  `enable row level security` on every newly created `public` table. It does NOT
  add policies. Consequence: **every new table in this plan starts RLS-enabled
  with zero policies (fully locked) until we add explicit policies** — Phase 1
  must include policies for `workspaces` / `workspace_members` /
  `workspace_entitlements` or provisioning breaks. The DEFINER flag is benign
  (DDL-time trigger, not a data path).
- **All data RPCs are `security invoker`** (only `rls_auto_enable` is DEFINER) —
  validates the simplifier below.
- **Two zero-policy tables**: `integration_settings` (intentional, secrets,
  service-role only) and **`task_files` (latent bug — created without a policy,
  so unreachable via the anon client today)**. Fix `task_files` as part of Phase 3.

### The one big simplifier

Every RPC is `security invoker` (none are `SECURITY DEFINER`). Invoker functions
respect the **caller's** RLS on the tables they read. So **fixing RLS on the base
tables automatically fixes the agent's memory/document/chat leaks** — we do not
have to rewrite each RPC or every AI tool. The folderId "fallback to global"
behavior becomes "fallback to all of *my* data," which is fine.

**Exception:** functions that read **materialized views** (`mv_operator_well_counts`,
`mv_person_affiliations` via `network_*`) — RLS does not apply to MVs, so those
must be gated *inside* the function.

---

## Architecture

Two scoping axes plus an entitlement layer.

### 1. Tenancy primitives (new tables)

```
workspaces            (id, name, created_at)
workspace_members     (workspace_id, user_id, role, created_at)   -- role: owner|admin|member
workspace_entitlements(workspace_id, feature, created_at)         -- feature: 'rrc_data', 'enrichment'
```

Today: signup creates one workspace, adds the user as `owner`, grants default
entitlements. One member per workspace == strict per-user. Later: add members to
a workspace and org-shared tables become visible to them; user-private tables stay
restricted to their owner.

### 2. SQL helpers (stable, `security definer`, search_path locked)

```sql
app_workspace_ids()              -> setof uuid   -- workspaces the caller belongs to
app_default_workspace_id()       -> uuid         -- caller's primary workspace (for insert defaults)
app_has_entitlement(feature text)-> boolean      -- any of caller's workspaces grants `feature`
```

`security definer` here avoids RLS recursion (membership check inside a policy on a
membership-scoped table). Each helper is marked `stable`, `search_path = ''`, and
granted to `authenticated` only.

### 3. Per-table column + RLS strategy

- **User-private:** add `owner_id uuid not null default auth.uid()`.
  RLS: `using (owner_id = auth.uid()) with check (owner_id = auth.uid())`.
- **Org-shared:** add `workspace_id uuid not null default app_default_workspace_id()`.
  RLS: `using (workspace_id in (select app_workspace_ids()))` (same for check).
- **Entitlement-gated reference:** no tenant column. Read-only to users.
  RLS: `for select to authenticated using (app_has_entitlement('rrc_data'))`,
  no insert/update/delete policy (writes happen via service-role ETL only).

`default auth.uid()` / `default app_default_workspace_id()` mean existing insert
call sites mostly don't change — the column auto-fills, and `with check` validates.
Child tables (e.g. `document_chunks`, `messages`, `task_files`) inherit scope from
their parent FK; their RLS checks the parent via `exists (...)` rather than carrying
a redundant column.

---

## Per-table classification (REVIEW THIS)

### User-private (owner_id, private even to org teammates)
| Table | Notes |
|---|---|
| `profile` | **Schema change**: drop singleton, re-key per `user_id`. |
| `conversations`, `messages` | Chat transcripts. messages inherit via conversation FK. |
| `agent_memory` | Personal facts/preferences. Fixes the `match_agent_memory` leak. |
| `budget_uploads`, `budget_transactions` | Personal finances. transactions inherit via upload FK. |
| `agent_context_docs`, `agent_context_revisions` | All 6 docs (soul/persona/memory/harness/app/skills) per-user — each user gets their own Archon. **Schema change**: drop the 6-singleton constraint, re-key per `(owner_id, kind)`; seed defaults per user on provisioning. |
| `integration_settings` | Per-user Google OAuth secrets. **Schema change**: add `owner_id`, drop singleton. Stays admin/service-role only for secret reads, now scoped by `owner_id`. |

### Org-shared (workspace_id, visible to workspace members)
| Table | Notes |
|---|---|
| `folders`, `files`, `file_placements` | Documents + KB. Diagrams are `files` rows. |
| `document_chunks` | Inherit scope from `files` FK. |
| `bridges`, `tags`, `file_tags` | KB graph. |
| `tasks`, `task_files` | task_files inherit via task FK. |
| `archon_skills` | Workspace's custom agent skills. Add `enabled boolean default true`; **only workspace admins/owners may toggle it** (admin-restricted update policy via `app_workspace_role()`), members read. |
| `project_memory` | Per-folder project summary; inherit via folder FK. |

### Entitlement-gated shared reference (feature flag, not tenant-scoped)
| Table / object | Entitlement |
|---|---|
| `wells`, `operators`, `operator_officers`, `well_operator`, `permits` | `rrc_data` |
| `leases`, `well_lease`, `operator_production`, `lease_summary`, `lease_production_recent` | `rrc_data` |
| `well_operator_detail` (view), `operators_*` / `*_production_*` / `network_*` fns | `rrc_data` |
| `mv_operator_well_counts`, `mv_person_affiliations` | gate inside `network_*` fns |
| `operator_contacts` (skip-trace PII) | `enrichment` (per your "same handling as RRC") |

### Infrastructure / special handling
| Table | Handling |
|---|---|
| `workspaces`, `workspace_members`, `workspace_entitlements` | members read their own workspace; writes via service-role provisioning. |
| `users` | identity map; readable to fellow workspace members (roster). |
| storage buckets (`avatars`, `files`, `budget-uploads`) | namespace keys by workspace/owner; rewrite `storage.objects` policies to match. |

A fourth helper is needed for the skills toggle:
`app_workspace_role(ws uuid) -> text` (owner/admin/member) for admin-only policies.

### Resolved
- agent_context_docs → **per-user**; integration_settings → **per-user**;
  archon_skills → **workspace-shared, admin-disableable**.

### Defaults I'm taking (say the word to change)
1. **Entitlements**: a single `rrc_data` flag gating both the RRC tables *and*
   `operator_contacts` ("same handling as RRC"). Easy to split later.
2. **Storage keys**: org-shared `files` bucket keyed `workspace_id/...`; private
   `budget-uploads` keyed `owner_id/...`; `avatars` stays per-user public.

---

## Implementation phases

### Phase 0 — Safety net
- Confirm a backup / point-in-time restore is available before touching RLS.
- Add an integration test harness that signs in as two distinct users and asserts
  user A cannot read user B's rows (per table) and the AI agent recall is scoped.
  These tests go RED first.

### Phase 1 — Tenancy foundation (one migration)
- Create `workspaces`, `workspace_members`, `workspace_entitlements`.
- Create `app_workspace_ids()`, `app_default_workspace_id()`, `app_has_entitlement()`.
- RLS on the three new tables.

### Phase 2 — Backfill existing data (one migration, idempotent)
- Create one workspace per existing `users` row (or a single "default" workspace if
  this is still effectively one real user today).
- Insert `workspace_members` (owner) for each.
- Grant `rrc_data` + `enrichment` entitlements to existing workspace(s).
- Stamp `owner_id` / `workspace_id` on all existing rows in private/shared tables.
- Migrate `profile` singleton → per-user rows.

### Phase 3 — Columns + RLS rewrite (per-table migrations)
- Add `owner_id` / `workspace_id` columns with defaults (now safe — backfilled).
- Replace every `using (true)` policy with the scoped policy for its class.
- Add `not null` after backfill confirms no orphans.
- Gate reference tables on `app_has_entitlement(...)`.
- Edit `network_*` functions to early-return when entitlement is absent.
- Scope `integration_settings` by `workspace_id`.

### Phase 4 — App layer
- **Signup provisioning**: on first sign-in / account creation, create workspace +
  owner membership + default entitlements (extend the existing
  `linkMembership`/accept-invite path; reuse service-role client appropriately).
- **`profile`**: rewrite reads/writes to be per-user (`src/lib/settings/profile.ts`,
  `actions.ts`, `org-data.ts`).
- **`permissions.ts`**: replace the `isOwner: true for everyone` stub with real
  workspace-role + entitlement checks.
- **Reconcile dead legacy org code**: `accounting/actions.ts` (`current_org_id`,
  `transactions`), `auth/membership.ts`, `settings/org*.ts`, `billing` —
  rewrite onto `workspaces` or delete. (Confirm which features are live.)
- **Audit every `getSupabaseAdmin()` table call** (38 sites): each must be a
  legitimate privileged op (provisioning, webhooks, secrets). Any normal data read
  via admin client that now needs scoping gets an explicit `workspace_id` filter or
  is moved to `getSupabaseServer()`.
- **Storage**: namespace upload keys; update signed-URL generation; update
  `storage.objects` RLS policies.
- **AI agent**: no logic change required for the core leaks (RLS handles it), but
  set `owner_id`/`workspace_id` on `remember`/`create_*` writes (defaults cover it),
  and confirm `recall_memory` / `search_documents` now return only caller-scoped
  rows via the new tests.

### Phase 5 — Verification
- Run the two-user isolation test suite (Phase 0) to GREEN.
- Add a CI check / SQL assertion that no table retains a `using (true)` policy
  except intended public ones (e.g. `avatars` bucket).
- Manual: sign in as two seeded users, confirm wells/contacts gated by entitlement,
  confirm AI drawer for user A never surfaces user B's files/memory.

---

## Implementation status (2026-06-25)

DONE — migrations written (`supabase/migrations/20260625000*.sql`):
- `…000100_tenancy_foundation` — workspaces / members / entitlements + helpers + RLS
- `…000200_tenancy_backfill` — founder (rankin@wildcatiq.ai) workspace + entitlements
- `…000300_private_tenancy` — conversations, messages, agent_memory, budget_*
- `…000400_shared_tenancy` — folders, files, placements, chunks, tasks, task_files
  (fixes its zero-policy bug), archon_skills (admin-toggle), tags (per-workspace
  uniqueness), file_tags, bridges, project_memory
- `…000500_agent_context_tenancy` — per-user docs (composite PK), templates,
  seed_agent_context()
- `…000600_identity_tenancy` — profile + integration_settings per-user, users own-row
- `…000700_reference_entitlements` — RRC + operator_contacts gated; MVs locked;
  network_* now SECURITY DEFINER with entitlement guard
- `…000800_storage_tenancy` — files / budget-uploads / avatars prefix-scoped

DONE — app layer (`src/`):
- `lib/auth/provisioning.ts` — ensureWorkspace(); hooked into `requireUser()`
- `lib/auth/entitlements.ts` — UI-side entitlement mirror
- `lib/settings/integrations.ts` + `integration-actions.ts` — per-user secrets
- `lib/budgeting/actions.ts` + `app/api/budgeting/extract/route.ts` — CLOSED the
  cross-tenant budget-upload read leak (owner-prefixed keys + ownership checks)
- `lib/files/actions.ts` — workspace-namespaced storage keys
- Verified: `getProfile` / `loadContextDocs` already query without an owner filter,
  so RLS scopes them with no change. Typecheck clean on all touched files.

DONE — verification: `supabase/checks/rls_isolation_check.sql`.

REMAINING — a product decision, NOT data-siloing (pre-existing breakage). Five
features reference tables that do not exist in the live schema (`organizations`,
`org_members`, `transactions`, `subscriptions`) and the missing `current_org_id()`
RPC. They are already broken against the live DB and were left untouched:
- accounting ledger (`lib/accounting/*`, `app/api/accounting/extract`)
- billing / subscriptions / well-cap (`lib/billing/*`, `app/api/billing/webhook`)
- team invites + member roster (`lib/auth/invite*`, `membership.ts`, `lib/settings/org*`)
- referral codes (`lib/auth/referral.ts`)
- onboarding (`app/onboarding/actions.ts`)
Decision needed: rewrite each onto `workspaces`/`workspace_members` (e.g.
`transactions.workspace_id`, subscription-per-workspace, invites-as-workspace-invites)
or delete if deferred. `linkMembership()` is already dead (no callers) and is
superseded by `ensureWorkspace()`.

TODO if those are revived: re-express the accounting extract route's `current_org_id`
ownership guard in the workspace model, and namespace `wells/actions.ts` upload keys
(left bare; still safe because file access is mediated by the RLS-scoped row lookup).

## Follow-on (2026-06-25): invites, onboarding, billing/referral removal

DONE:
- Migration `…000900_invites_onboarding` — `workspace_invites` table + onboarding
  columns on `workspaces` (owner_uid, company_address, employee_count, well_count,
  onboarding_completed_at) + `name/email/permissions` on `workspace_members`.
  Founder workspace backfilled as already-onboarded.
- Invite flow ported from wildcat-webapp onto workspaces: `inviteMember` /
  `resendInvite` / `cancelInvite` / `removeMember` / `setMemberPermissions`
  (settings/actions), `getOrgMembers` roster merges active members + pending
  invites, `lookupInvite` + `/api/auth/accept-invite` create the auth account and
  add a `workspace_members` row to the inviting workspace, seeding the new user's
  agent context. Email via Brevo (`BREVO_*` added to `.env.local`).
- Onboarding refactored: two-step (details → invite), writes to `workspaces`;
  proxy gate sends incomplete OWNERS to `/onboarding` and naturally skips invited
  members (they own no workspace). New owners auto-provision via `ensureWorkspace`.
- `permissions.ts` now resolves real role/permission from `workspace_members`
  (owner/admin = full; member = granted set). `requireAdmin` enforces it.
- Billing + referral REMOVED: deleted `lib/billing/`, `app/api/billing/`,
  `lib/auth/referral.ts`, AI-credit gates/meters in 5 routes, the well-cap check,
  Stripe env helpers, and all referral UI. Dead `lib/auth/membership.ts` deleted.
- Typecheck: zero source errors.

STILL BROKEN (pre-existing dead-schema, separate decision): accounting ledger
(`lib/accounting/*`, `app/api/accounting/extract` — `transactions` table +
`current_org_id()`). Not touched beyond removing its billing gate.

INVITE TEST CHECKLIST (after running migrations):
1. `auth.users` has rankin@wildcatiq.ai; run migrations `20260625000100`–`000900`.
2. Settings → Organization → invite an email → Brevo sends `localhost:3000/invite/<token>`.
3. Open the link → set password → lands in the founder's workspace as a member
   (sees org-shared files/tasks, NOT the founder's private chats/memory/budget).

## Risks
- **RLS recursion** on membership policies — mitigated by `security definer` helpers.
- **Backfill correctness** — rows with NULL owner after backfill would become
  invisible; verify counts before adding `not null`.
- **`default auth.uid()` in non-request contexts** (webhooks, ETL via service role)
  — service role has no `auth.uid()`; those paths must set columns explicitly.
- **Materialized views** can't be RLS'd — entitlement gating must live in the
  functions that read them; revoke direct `select` on the MVs from `authenticated`.
- **Half-migrated legacy code** referencing non-existent tables may break builds
  once touched — scope the reconciliation to live features only.
