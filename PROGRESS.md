# PROGRESS.md

## Phase 1 — Scaffold, database, seed, public site — DONE

### What is built

- **Project**: Next.js 14 App Router, TypeScript strict, Tailwind, `vitest`, `tsx` seed runner. Commands:
  `dev`, `build`, `start`, `test`, `typecheck`, `seed`, `reset`.
- **Database**: `lib/schema.sql` created exactly as specified (all 30 tables, `PRAGMA foreign_keys = ON`, the
  check constraints and the comment that theme membership is computed at read time). `lib/db.ts` gives one shared
  connection, WAL mode, `ensureSchema()`, drop-and-recreate helpers, `nowIso()` and `uuid()`. `config` is seeded with
  `visibility_epoch=1` and `policy_version=v1`.
- **Seed** (`lib/seed.ts` + `lib/seed-data-core.ts` + `lib/seed-data-content.ts`): the Section 19 dataset exactly —
  4 products, 6 provisioned employees with their separate platform grants, 4 fictional organisations with 6 product
  entitlements, 8 client users including the multi-membership consultant and the revoked former member, 6
  contributions (3 published seasonality items from 3 distinct organisations, 1 published single-organisation
  collections item, 1 submitted item carrying the sensitive strings, 1 private draft), 4 live `shared_views` with
  coarsened region and quarter, per-purpose `consents` with `train` always refused, moderation decisions, 3 scanner
  flags on the submitted item, 2 themes, the seasonality idea with 3 evidence grants plus status history and the
  approved public update, 2 media assets with placeholder files under `data/private-media/`, 2 content blocks, and 1
  moderator notification.
- **Public site**: `/`, `/products`, `/products/[slug]`, `/solutions`, `/technology`, `/media`, `/insights`, `/about`,
  `/connect`, `/trust`, plus a static `/login` notice. Section 18 home content is all present (hero, six capability
  cards, four featured products, six trust items, footer note). Visitor nav is Products, Solutions, Technology, Media,
  Insights, About, Request Demo, Sign in — no Admin, no Playground, no dead links.
- **Enquiry form**: `/connect` carries the demo request and hackathon registration forms, posting to the public
  `POST /api/enquiries` (zod validated, stored in `enquiries`). `GET /api/public/products` serves the catalogue.
- **Design**: `styles/tokens.css` holds colour, font, spacing, radius and container tokens as CSS variables with the
  required brand-token comment; light default, dark via `prefers-color-scheme`; `prefers-reduced-motion` handled;
  visible focus outline and skip link for WCAG 2.2 AA.
- **Tests**: `tests/seed.test.ts` (8 tests) — schema completeness, Section 19 counts, three distinct organisations on
  the seasonality topic versus one on the suppressed topic, drafts never reaching `shared_views`, scanner flags,
  coarsening, `train` consent always refused, placeholder media and `config` rows.

### Verified

- `npm run seed` recreates the database from nothing and prints row counts.
- `npm test` → 8 passed. `npm run typecheck` → clean. `npm run build` → clean, 14 routes.
- `/`, `/products`, `/products/riva`, `/products/credit-strategy-simulator`, `/solutions`, `/technology`, `/media`,
  `/insights`, `/about`, `/connect`, `/trust`, `/login` → 200. `/products/nope`, `/configurator`, `/playground`,
  `/admin`, `/employee` → 404.
- Browser check on `/connect`: filled and submitted the demo form, saw the "Request stored" status, and confirmed two
  rows landed in `enquiries`. Invalid payloads return 400 with field errors.
- Browser check on `/` and `/products/[slug]`: tokens applied (background, text, font, radius, container width),
  landmarks and labels exposed, no Admin or Playground links in the header.

### Known issues

- `/media` lists public assets but cannot play them: the protected streaming endpoint with `Range` support is Phase 7.
  The page says so rather than linking to a file.
- `/login` was a static notice in Phase 1; the real code flow replaced it in Phase 2.
- The three scanner flags on the seeded submission are produced by a seed-local helper covering `email`, `amount` and
  `customer_name`. The full `lib/scanner.ts` (seven patterns) is Phase 4.
- The public pages are server-rendered against SQLite; authorised responses now carry `Cache-Control: no-store`
  (Phase 2), public pages are still rendered dynamically rather than cached deliberately.
- Layout was checked at desktop width in a browser; iPad and phone widths follow the Tailwind breakpoints used but
  have not been visually inspected yet.

## Phase 2 — Auth, sessions, policy, audit — DONE

### What is built

- **Policy engine** (`lib/authorize.ts`): the Section 7.3 algorithm in order — invalid or missing audience denied and
  never treated as public, `public` read-only, `employee` requires `isEmployee`, `tenant:<id>` requires the session's
  active tenant, `tenant:<id>:product:<slug>` adds the entitlement check, `community` needs an organisation or a
  moderator/product-owner employee, then the `ACTION_PERMISSION` map. Client permissions come only from `client_role`;
  platform grants are stored separately, so no client role can reach `platform.role.grant`, `audit.read`,
  `learning.moderate`, `content.publish`, `video.publish`, `org.manage` or `product.owner`.
- **Handler wrapper** (`lib/withAuth.ts`): session and actor loaded from the `sid` cookie, audience computed
  server-side, `authorize()` called, an audit row written for the allow *and* the deny, then 401/403/404 responses
  exactly as Section 7.4 specifies and `Cache-Control: no-store` on every authorised response. Exports `notFound()`,
  `badRequest()` and `conflict()` for handlers.
- **Sessions and codes** (`lib/session.ts`): 6-digit codes stored as `sha256` with a 10-minute expiry and single use,
  sessions with 30-minute idle and 8-hour absolute limits and `last_seen` touched on each request, revocation,
  `setActiveTenant()` that verifies an active membership, `isEmployeeEmail()` requiring `@azentio.com` **and**
  `employee_provisioning.active = 1`, and `buildActor()` re-reading grants, memberships and entitlements every request.
  In-memory rate limits: 5 code requests and 10 verifies per address per 10 minutes.
- **Audit** (`lib/audit.ts`): hash-chained rows (`prev_hash` = previous row's hash, 64 zeros for the first),
  `readAudit()` and `verifyChain()`; denials are recorded the same way as allowances.
- **API**: `POST /api/auth/otp` (public, always `{ ok: true }`), `POST /api/auth/verify` (public, sets the cookie),
  `POST /api/auth/logout`, `GET /api/me`, `POST /api/workspaces/switch`. All but the two Section 7.4 public endpoints go
  through `withAuth`.
- **Pages**: `/login` (two-step code flow, seeded account table, "already signed in" state), `/dev/outbox` (404 unless
  `DEMO_MODE=true`, banner exactly as specified, queued codes with "queued (demo)" status and an honest invitation
  section), `/c` (workspace chooser), `/c/[tenantId]` (URL segment compared with the session; mismatch renders a 404),
  `/employee`, `/moderate`, `/admin`, `/admin/audit` (audit table plus the chain-valid check). Every authenticated page
  carries the active-organisation chip required by Section 23; `/api/auth/verify` sets the cookie, no page or component
  stores a role, permission or tenant id in the browser.
- **Tests**: `tests/policy.test.ts` (14 tests) — the five DoD policy cases plus public read-only, unauthenticated,
  community, client-role derivation, the rule that a client admin cannot reach a platform permission, the `withAuth`
  import guard over every file in `app/api/**` with a fixture proving an unwrapped handler fails. `tests/session.test.ts`
  (12 tests) — code issue/verify/replay/expiry/unknown-address, rate limits, the employee rule including a deprovisioned
  account, single versus multiple membership, workspace switching, revoked/expired/idle sessions, the revoked former
  member, entitlements, and an audit chain that breaks when a row is edited and repairs when it is restored.

### Verified

- `npm run typecheck` clean, `npm run build` clean (26 routes), `npm test` → 34 passed across 3 files.
- Logged in as all 14 seeded accounts over HTTP (`/api/auth/otp` → `/dev/outbox` → `/api/auth/verify` → `/api/me`),
  each with a code read from the outbox and an httpOnly session cookie: all returned 200 with the server-derived active
  tenant, memberships, role and permissions.
- `ex.member@aurora.example`: signs in, `memberships: []`, `activeTenant: null`, `/c/tenant-aurora` → 404, and a body
  naming that tenant is refused.
- `shared@consult.example`: `needsWorkspaceChoice: true`, switch to Beacon 200, switch to Cedar and Aurora 404, session
  stays on Beacon.
- `maya@aurora.example` (browser): `/c/tenant-aurora` 200 with the chip "Active organisation: Aurora Microfinance",
  `/c/tenant-beacon` 404, `/employee`, `/moderate` and `/admin/audit` each showing "Access denied — employee access
  required"; sign-out returns to `/` and the next `/api/me` is 401.
- Anonymous: `/api/me` and `/api/workspaces/switch` → 401, `/employee` → 307 to `/login`.
- Grants enforced on pages: Meera reaches `/moderate`, Dev (an employee without `learning.moderate`) does not; Priya's
  `/admin/audit` lists rows and reports "Chain valid"; editing an audit row makes `verifyChain()` report the exact row
  id that broke.
- Cookie flags observed on localhost: `HttpOnly`, `SameSite=Lax`, `Path=/`, 8-hour `Max-Age`, no `Secure` (added for any
  non-localhost host). `Set-Cookie` never carries a role or tenant id.

### Known issues

- `/dev/outbox` lists the newest 50 queued entries from the demo database, so a busy demo shows older codes too; a code
  is only useful while it is unused and unexpired.
- The public header still offers "Sign in" to an already authenticated visitor; the session bar above it carries the
  identity, the area links and sign-out. Consolidating the header is a Phase 9 accessibility pass.
- Screens were validated structurally (accessibility tree, snapshots and HTTP status) rather than by screenshot: the
  in-app browser surface was hidden, so viewport screenshots were unavailable.
- Invitations (`POST /api/invitations`, `/accept-invite/[token]`) are Phase 8 per Section 22, so the outbox says plainly
  that no invitation link exists yet.

## Phase 3 — Client portal and contributions — DONE

### What is built

- `lib/contribution-schema.ts` — the Section 9 zod schema shared by the browser and the server, plus the plain-language
  field errors and the type/evidence/confidence labels. `industry`, `region` and the offering list are never accepted
  from a request.
- `lib/lifecycle.ts` — the Section 9 state machine as data: all thirteen transitions with their actor and guard text,
  `canTransition()`, `authorNextStates()` so the UI never offers a dead button, `STATE_PLAIN` and the icon set `STATE_MARK`.
- `lib/consents.ts` and `lib/sharing-copy.ts` — the Section 11 consent matrix, the four consent rows written on submit
  with the stored `policy_version`, and the sharing copy. The pure parts live in `sharing-copy.ts` so client components
  render exactly the words and the matrix the server records without importing `better-sqlite3`.
- `lib/contributions.ts` — the reads: the organisation and "mine" lists, `canReadContribution()` (the Section 9 draft
  rule), entitled offerings, the DTO and `ownerAudienceOf()`, which takes the audience from the database row.
  `lib/contribution-writes.ts` — the mutations: create draft, edit, submit and withdraw, each with its audit row.
- API: `GET/POST /api/contributions`, `GET/PATCH /api/contributions/[id]`, `POST .../submit`, `POST .../withdraw`,
  `GET /api/notifications`, `POST /api/notifications/[id]/read`. All go through `withAuth`; the record routes are marked
  `record: true` so a cross-tenant id answers 404 rather than 403.
- `withAuth` now answers 401 before any record lookup and exposes `CROSS_TENANT_DENY_REASONS`, the set the 404 mapping
  uses, so tests assert against the same list the wrapper reads.
- Header (`SessionBar`): active-organisation chip, area links, `WorkspaceSwitcher` for multi-membership accounts,
  `NotificationsBell` with a panel and per-item mark-as-read, sign out.
- Pages: the client dashboard (entitled offerings, observation status counts, recent activity, relevant ideas, empty
  state with no entitlements), `/c/[tenantId]/observations` with **My observations** and **Our organisation** tabs,
  `.../new`, `.../[id]` with the Visibility Inspector and the author's action panel, `.../[id]/edit`, and `/notifications`.
  `components/observation-form.tsx` holds the form state and the request; `components/observation-fields.tsx` holds the
  eight field controls and their per-field errors.
- `tests/portal-rules.test.ts` — the four extra rules of this phase, each asserted against a seeded account that tries to
  break it: another user's `in_app` row and a `dev_outbox` row, `tenant_id` in a query string and in a body, a viewer's
  `POST`, and a draft `PATCH` carrying a sharing choice.

### Verified

- `npm run typecheck` clean, `npm run build` clean (28 static pages, every new route dynamic), `npm test` → 57 passed
  across 6 files, of which 23 are the new Phase 3 suites: `tests/contributions.test.ts` (9), `tests/lifecycle.test.ts`
  (7) and `tests/portal-rules.test.ts` (7, the four extra rules below). A 38-check HTTP sweep on a freshly seeded
  database repeats the same result before and after the module split in Decision 37.
- DoD, on a freshly seeded database over HTTP: `POST /api/contributions` as `sam@beacon.example` with
  `tenant_id: "tenant-aurora"`, `author_id`, `state: "Published"`, `industry` and `region` in the body created 201 and
  stored `tenant_id = tenant-beacon`, `author_id = user-sam-beacon.example`, `state = Draft`, `industry = NBFC`,
  `region = Pune` — the session and the organisation record decided all of it.
- DoD: that draft is invisible to others. A client_admin in the same organisation got 404 on
  `GET /api/contributions/<id>`, the id appears in neither organisation list, and `shared_views` holds no row for it.
  The author still gets 200. The same draft filed with `sharing_choice: "organisation"` instead answers 200 for that
  client_admin and appears in their `?tab=org` list — the record's own sharing choice is the only thing that changed.
- DoD: `maya@aurora.example` requesting Beacon's published contribution id gets 404 on the API and 404 on
  `/c/tenant-beacon/observations/<id>`; every other `/c/tenant-beacon/...` page is 404 for her; an anonymous page
  request redirects to `/login` and an anonymous API request gets 401.
- Submit writes the four consent rows (`process 1, publish 1, attribute 1, train 0`, `policy_version v1`), moves the item
  to Submitted, notifies the author and the moderators, and re-submitting answers 409. `PATCH` on a Submitted item also
  answers 409.
- "Draft save never changes sharing": a `PATCH` carrying `sharing_choice: "community"`, `attribution_requested: true`
  and `state: "Published"` returned 200 and left the item `private`, `attribution_requested 0`, `Draft` — only
  `confidence` moved — and the colleague's `GET` on that id stayed 404 afterwards.
- Withdrawal: a Draft withdraws (200, state Withdrawn, invisible to the colleague); withdrawing a Published item returns
  409 and says the published-item purge arrives with the withdrawal phase.
- A viewer (`shared@consult.example` in Beacon) sees "can read but not create", the create page shows the refusal card,
  and `POST /api/contributions` answers 403.
- Notifications: `GET /api/notifications` returns only the caller's own `in_app` rows. On a database holding 4
  `dev_outbox` rows and 3 `in_app` rows, `sam@beacon.example` and `shared@consult.example` — both of whom have a
  `dev_outbox` row of their own — each get `{"items":[],"unread":0}`, while the moderator `meera.mod@azentio.com` gets
  exactly her one `in_app` row and none of anyone else's. The bell's list and mark-as-read work (200, then 404 when the
  same row is marked again), `/notifications` renders for a member and redirects for an anonymous visitor, and
  `verifyChain()` reports the audit chain valid (50 rows on the swept database, allow and deny both recorded).

### Known issues

- Search is not built yet, so the DoD's "invisible to search" is proven the only way it can be today: a draft has no
  `shared_views` row, and `shared_views` is the sole source the Phase 4 feed and search will read. (Superseded in Phase 4:
  search now exists, and a draft still has no row to find.)
- The scanner does not run yet (Phase 4), so a Submitted item shows no flags; the Visibility Inspector states that the
  scan, the de-identified summary and the withdrawal purge arrive later. (Superseded in Phase 4: submit runs the scan.)
- A material edit of a Published item (version +1) is refused with 409 until the publishing phase builds it.
- `body` is returned only to its author, which is stricter than `contribution.read.org` requires; colleagues see
  metadata and state.
- Screens were verified structurally (HTTP status plus rendered text), not by screenshot: the in-app browser surface is
  still unavailable.

## Phase 4 — moderation, publishing, feed and search — DONE

### Built

- `lib/scanner.ts` — the seven Section 10.1 patterns (email, phone, long number, amount, credential, blocked customer
  name, rare place), each rebuilt per call so no cached global `RegExp` keeps a `lastIndex`, plus the Section 10.2
  coarsening helpers `coarseRegion()` and `coarseQuarter()`. A hint is labelled as a hint everywhere it appears.
- `lib/publish.ts` — `buildSharedView()` is pure and whitelists twelve fields; `publishContribution()` refuses while a
  hint is unresolved (409), writes the `shared_views` row as `live`, records the decision with its internal note, and
  notifies the author; `unpublishContribution()` sets the same row to `suspended`. Attribution appears only when the
  author asked **and** a moderator approved. `withdraw.ts` and `cohort.ts` arrive in Phase 5.
- `lib/visible.ts` — the only reader of `shared_views` for a user. `visibleSharedViews(actor, filters)` returns the
  DTO list the feed, search, export, dashboard and learning page all use; `visibleFacets()` lists only values that
  already appear in that result; `FORBIDDEN_SHARED_KEYS` and `SHARED_VIEW_DTO_KEYS` are exported so a test and an HTTP
  sweep can assert against the same lists the code uses.
- `lib/moderation.ts` (queue, review bundle, open reports) and `lib/moderation-actions.ts` (start, return, reject,
  resolve a hint, create a report) — each one re-checks the grant, the Section 9 edge and, for a record-scoped read,
  whether the private source may be shown at all.
- `lib/export.ts` — CSV of exactly the DTO keys; an export is the same rows as the feed in another encoding.
- `lib/contribution-writes.ts` — submit now runs the scanner inside the same transaction and stores the hints, and
  re-submitting replaces them. `lib/seed.ts` seeds the Submitted item through the real scanner, so the queue shows what
  a moderator would see.
- API: `GET /api/moderation/queue`, `GET /api/moderation/[id]`, `POST .../start|return|reject|publish|unpublish`,
  `POST /api/moderation/flags/[id]/resolve`, `GET /api/feed`, `GET /api/search`, `GET /api/export`,
  `POST + GET /api/reports`.
- Screens: `/moderate` (queue, three state groups, open reports), `/moderate/[id]` (private original beside the live
  shared copy, hints with their recorded closures, the moderator's moves, decisions, consents),
  `/c/[tenantId]/learning` (feed with six filters, search, export links, report action, honest count), plus
  `components/scanner-flags.tsx`, `review-actions.tsx`, `moderation-form.tsx`, `shared-item-report.tsx`.
- Tests: `tests/scanner.test.ts` (10), `tests/visible.test.ts` (13), `tests/moderation.test.ts` (7),
  `tests/moderation-fixtures.ts` (shared builder, not collected), and the Phase 4 gate added to
  `tests/lifecycle.test.ts` (11).

### Verified

`npm run typecheck` clean · `npm test` → **91 passed in 9 files** · `npm run build` clean (33 static pages, every new
route dynamic). The HTTP evidence below ran against a freshly seeded scratch database
(`DATA_DIR=data/live4d npm run seed && npx next start -p 3104`) on the same build, through a throwaway sweep script; the
screens and the report path were also checked with a Node fetch sweep on the same build. Every scratch artifact was
deleted afterwards; `data/app.db` was never touched by a write.

- **DoD — the seeded Submitted item shows flags and cannot be published until they are resolved.**
  `GET /api/moderation/contribution-c-aurora-submitted` returned
  `"flags":[{"id":"flag-…-1","kind":"amount","snippet":"INR 4,500,000","resolved":false},{… "customer_name","Harbor Foods" …},{… "email","ops.head@aurora.example" …}]`
  and `"unresolved_flags":3`. `POST …/publish` before any closure answered
  `409 {"error":"3 scanner hint(s) unresolved; publishing stays blocked until a moderator resolves each one"}`; after
  the three `POST /api/moderation/flags/<id>/resolve` calls, which reported
  `"unresolved_flags":2`, `1`, `0`, the same publish answered `200`.
- **DoD — the shared payload contains none of `tenant`, `author`, `contribution_id`, `internal_note`.**
  `GET /api/feed` as `maya@aurora.example`, grepped for each key name: `tenant`, `tenant_id`, `author`, `author_id`,
  `contribution_id`, `internal_note`, `moderator_id`, `body`, `note`, `notes`, `reporter_user_id`, `attachments` →
  **absent** for all twelve; the private strings `ops.head@aurora.example`, `Harbor Foods`, `INR 4,500,000` and the
  reviewer note → **absent**. The new item's keys are exactly
  `id,title,summary,topic,offering_slug,industry,region_coarse,period_quarter,evidence_type,confidence,attribution,published_at`.
- **DoD — counts equal results.** `feed "count":5 items=5`, `search?q=seasonal "count":4 items=4`,
  `export?format=json "count":5`, `export?format=csv` header
  `id,title,summary,topic,offering_slug,industry,region_coarse,period_quarter,evidence_type,confidence,attribution,published_at`
  with 5 rows. After one unpublish all three dropped to 4 in the same request.
- **DoD — `lifecycle.test.ts` and `visible.test.ts` pass.** `npx vitest run tests/lifecycle.test.ts tests/visible.test.ts`
  → 11 + 13 passed (24); the full run is 91 in 9 files.
- Tenant scope and audience stayed intact: anonymous `GET /api/moderation/queue`, `/api/feed`, `/api/export`,
  `/api/search` → `401`; a client's `GET /api/moderation/queue` → `403`; a client's `GET /api/reports` → `403`.
- Report → console → unpublish: `POST /api/reports` as a member of another organisation returned
  `{"report_id":"628c288e-…","notice":"Your report is stored and appears in the moderation console. Nothing has been
  emailed, and the item stays live until a moderator acts."}`; `GET /api/reports` as the moderator showed
  `"status":"open"` × 1; `POST /api/moderation/contribution-c-aurora-submitted/unpublish` → `200`, and the item was
  then absent from the feed, the search result and the CSV.
- The credit line needs both halves. On a live item whose author asked: moderator declines →
  `attribution=null`; moderator approves → `attribution="Beacon Credit"`, `region_coarse="West India"`,
  `period_quarter="2026-Q3"`. On the seeded item, where the author did not ask, an approved credit still published
  `attribution=null`.
- Screens: `/moderate` as the moderator → 200 with all four groups (queue, in review, returned, open reports);
  `/moderate` and `/moderate/<id>` as a client → 200 **Access denied** shell, and `ops.head@aurora.example`,
  `Harbor Foods`, `Manual seasonal caveats` and the queue headings are **absent from the response body** — the pages
  guard themselves, not only the layout (Decision 41). `/c/tenant-aurora/learning` rendered 4 cards for 4 feed items.

### Known issues

- A report does not suspend the item or open a thread yet; it stores, opens in the console and notifies. Section 22
  puts "report triggers suspension and author notification" in Phase 6 (Decision 45).
- Withdrawal, the cohort guard and `visibility_epoch` were Phase 5, so at the end of Phase 4 `lib/publish.ts` was the
  only writer of `shared_views` and a suspended row stayed suspended. Phase 5 added `lib/withdraw.ts` and
  `lib/cohort.ts`.
- Themes and idea evidence are seeded but not yet rendered from the shared reads; the learning page says so rather
  than presenting a count as a market statistic.
- Screens were verified by HTTP status plus rendered text, not by screenshot.

## Phase 5 — withdrawal, cohort guard, themes — DONE

### What is built

- `lib/cohort.ts` (Section 13): `cohortMin()` from `COHORT_MIN` (default 3), `distinctOrgCount(theme, filters)` as
  `COUNT(DISTINCT contributions.tenant_id)` over `live` shared views joined by `contribution_id` and matched on
  `topic_key` + `offering_slug`, and `themeVisibility(actor, theme, filters)` as the only way a theme reaches a page.
  Visible → title, description, offering, `orgBucket` (`"3 or more organisations"`), quarters range, limitation text,
  small-sample warning under 5 organisations, and evidence from `visibleSharedViews()`. Suppressed →
  `{ suppressed: true, reason: "Fewer than the minimum number of organisations" }` with `evidence: []`,
  `orgBucket: null`, `quarters: null` and no description. An unauthorised actor is answered the same way after the
  denial is audited.
- `lib/withdraw.ts` (Section 12): `withdrawContribution()` in one `better-sqlite3` transaction — ownership and state
  checks, `state='Withdrawn'`, `DELETE FROM shared_views WHERE contribution_id=?`, the `idea_evidence_grants` rows that
  pointed at those ids, `config.visibility_epoch` +1, notifications with idempotency keys for the author (who is told
  even when an organisation admin acted) and for `ideas.created_by` of every affected idea, then the audit line. Then
  `withdrawalClock()` re-queries through `visibleSharedViews`, `visibleSharedViewById`, `themeVisibility` and the public
  `content_blocks` and returns `{ elapsedMs, checks: { search, feed, theme, aira } }`.
- `lib/lifecycle.ts`: the `Unpublished → Withdrawn` edge (Decision 47) and `actorNextStates(from, { isAuthor,
  isOrgAdmin })` replacing `authorNextStates`, which had hidden the Withdraw button from the author of a published item.
- API (Section 17): `GET /api/themes` and `GET /api/themes/[slug]` on audience `community`, action `read.theme`;
  `POST /api/contributions/[id]/withdraw` now returns `{ item, clock, notice }`.
- Pages (Section 18): `/c/[tenantId]/themes` (shown / not-shown groups, quarter and word filters, cohort explanation),
  `/c/[tenantId]/themes/[slug]`, a themes section on `/c/[tenantId]/learning`, a **Themes** entry in the session bar,
  and `WithdrawalClockCard` with the production SLA sentence on the observation page.
- Tests: `tests/cohort.test.ts` (7) and `tests/withdrawal.test.ts` (7), plus the published-withdrawal case and the
  button-offer case in `tests/lifecycle.test.ts`. 106 tests in 11 files pass; `tsc --noEmit` is clean; `next build` is clean.

### Verified (exact evidence)

- **DoD — `seasonality-context` visible with 3 organisations.**
  `curl -s -b jar -X POST localhost:3000/api/auth/otp -d '{"email":"maya@aurora.example"}'` → code from
  `GET /dev/outbox` → `POST /api/auth/verify -c jar`, then
  `curl -s -b jar localhost:3000/api/themes`:
  `seasonality-context | suppressed=false | orgBucket="3 or more organisations" | evidence=3 | reason=null`
  with `"quarters":{"from":"2026-Q2","to":"2026-Q3"}` and `"smallSample":true`. Response header
  `cache-control: no-store`. `tests/cohort.test.ts` asserts the same shape.
- **DoD — `collections-messaging` suppressed.** Same call:
  `collections-messaging | suppressed=true | orgBucket=null | evidence=0 | reason="Fewer than the minimum number of organisations"`;
  `GET /api/themes/collections-messaging` → 200 with `item.suppressed=true`. The payload has no
  `contribution_id`, `tenant`, `tenant_id`, `author`, `author_id`, `internal_note`, `notes`, `note`, `attachments`,
  `body`, `moderator_id`, `reporter_user_id` (checked against all 13 `FORBIDDEN_SHARED_KEYS`: `hits: []`).
- **DoD — withdrawing Aurora's published item suppresses the theme, clock all `true` under 1 s.**
  `curl -s -b jar -X POST localhost:3000/api/contributions/contribution-c-aurora-seasonality/withdraw -d '{}'` →
  `state Withdrawn clock {"elapsedMs":1.103,"checks":{"search":true,"feed":true,"theme":true,"aira":true}}`; the next
  `GET /api/themes` reports `seasonality-context | suppressed=true | orgBucket=null | evidence=0`.
  `tests/withdrawal.test.ts` asserts `elapsedMs < 1000` and all four checks `true`.
- **One transaction, all effects.** After that call: `shared_views` rows for the contribution `0`;
  `idea_evidence_grants` fell from 3 to 2 (only the withdrawn id removed); `config.visibility_epoch` `1 → 2` (then 3
  after the second withdrawal); `GET /api/feed` dropped from 4 to 3 items
  (`shared-view-contribution-c-delta-collections`, `…-c-beacon-seasonality`, `…-c-cedar-seasonality`) and
  `GET /api/feed?q=misread` returned `[]`. Notifications: `user-maya-aurora.example` /
  `contribution.withdrawn` / channel `in_app` / status `stored`, and `user-rohan.po` / `idea.evidence_withdrawn`.
  Audit: `decision=allow`, `reason="Published to Withdrawn, 1 shared view(s) purged, evidence grants removed,
  visibility epoch incremented"`.
- **Authority stayed on the server.** Anonymous `POST …/withdraw` → `401`; `maya@aurora.example` (tenant-aurora) on
  Cedar's item → `404 {"error":"not found"}`; a viewer at Beacon on Beacon's already-withdrawn draft →
  `403 {"error":"forbidden"}`; `admin@beacon.example` on Sam's published item → `200` with
  `clock {"elapsedMs":0.523,"checks":{…all true}}` and the author notified
  (`"An organisation admin withdrew your observation …"`). A Submitted item → `409`, and its `shared_views` count stayed 0.
- **Themes pages render both shapes.** `/c/tenant-aurora/themes` (fresh seed) → 200 with 1
  `data-testid="theme-visible"` card and 1 `data-testid="theme-suppressed"` card, and the body contains
  `3 or more organisations`, `Small sample`, `Limitation:`, `2026-Q2 to 2026-Q3`. After the Aurora withdrawal the same
  page renders 0 visible and 2 suppressed. `/c/tenant-aurora/themes/seasonality-context` → 200 with the limitation text
  and the evidence titles; `/c/tenant-beacon/themes` as an Aurora actor → `404`; `GET /api/themes/no-such-theme` → `404`.
- **Withdrawal UI offers the right move and states the SLA.**
  `/c/tenant-aurora/observations/contribution-c-aurora-seasonality` (Published) contains `Withdraw this item` and
  `Search, AIRA and API reads within 60 seconds (p99); derived digests and caches within 5 minutes. Content already
  viewed, exported or copied elsewhere cannot be recalled.`; `/c/tenant-aurora/learning` contains the themes section
  with both cards and an **All themes** link.

### Known issues

- The clock's `aira` check covers the citation pool only; AIRA's answerer is Phase 9 (Decision 49).
- Section 18's bookmark affordance on the learning page is not built — no bookmarks table exists in the Section 5
  schema and Section 0 forbids inventing one (Decision 54).
- Suppressed themes still show their editorial title on the index page; only the evidence, counts and description are
  withheld. Section 13 asks for the latter, and the card explains why the title is not contributor data.
- Screens were verified by HTTP status plus rendered text, not by screenshot.

## Phase 6 — ideas, status loop, reports — DONE

### What was built

- **`lib/idea-lifecycle.ts`** — Section 14 as data: `IDEA_STATUSES` (`Proposed, Under review, Planned, In progress,
  Released, Not proceeding`), the forward-only `TRANSITIONS` map, `nextIdeaStatuses()` and `IDEA_STATUS_PLAIN` (the
  client wording). `IDEA_PRIORITIES` is internal-only.
- **`lib/idea-schema.ts`** — `ideaCreateSchema`, `ideaEditSchema`, `ideaStatusSchema`, `ideaEvidenceSchema`,
  `ideaPublicUpdateSchema`, `ideaUpdateApprovalSchema`, plus the `fieldErrors` re-export the routes answer with.
- **`lib/ideas.ts`** — every idea read. `listIdeas`, `getIdea`, `ideaDTO`, `ideaHistory`, `ideaCounters`,
  `unavailableGrants`, `grantableViews`, `ideaUpdates`, `pendingUpdates` and `clientIdeas()`. `MODERATOR_APPROVED` is
  the derived `EXISTS` over `platform_grants` that decides whether a client text is visible (Decision 56). Evidence is
  re-read through `lib/visible.ts` at call time, so a suspended or purged copy drops out of an idea with no extra write.
- **`lib/idea-writes.ts`** — `createIdea`, `editIdea`, `moveIdeaStatus` (illegal edge → `409` before any row is
  written), `grantEvidence`, `revokeEvidence`; each writes `idea_status_history` where relevant and one audit row.
- **`lib/idea-updates.ts`** — `proposePublicUpdate()` (stores the text, notifies every `learning.moderate` holder, stays
  client-invisible) and `approvePublicUpdate()` (re-points `approved_by`, refreshes `at`, notifies the idea's author).
- **`lib/reports.ts`** — `reportSharedView()` (suspend the copy, notify the author and the moderators),
  `resolveReport(actor, id, "restore" | "keep_out", note)` and `hasOpenReport()`.
- **`lib/view-state.ts`** — the fourth `shared_views` writer, UPDATE-only: `suspendLiveViews`, `suspendSharedView`,
  `restoreSharedView`. It selects nothing (Decision 59).
- **Routes** — `POST|GET /api/ideas`, `PATCH|GET /api/ideas/[id]`, `PATCH /api/ideas/[id]/status`,
  `POST|DELETE /api/ideas/[id]/evidence`, `POST /api/ideas/[id]/public-update`,
  `POST /api/ideas/[id]/public-update/approve`, `GET /api/client/ideas`, `POST /api/reports`, `GET /api/reports`,
  `POST /api/reports/[id]/resolve`.
- **UI** — `/employee/ideas` + `IdeaForm`, `/employee/ideas/[id]` + `IdeaWorkspace` (status move, evidence attach/detach,
  client update), `/c/[tenantId]/ideas`, the `IdeaUpdateApproval` and `ReportActions` blocks in `/moderate`, the Ideas
  link on the client workspace and the Product owner link in the session bar.
- **Tests** — `tests/ideas.test.ts` (17) and `tests/reports.test.ts` (10). 13 files / 133 tests pass, `tsc --noEmit` is
  clean and `next build` registers every new route.

### Verified (exact evidence, live against `next start -p 3100` on a fresh seed)

- **DoD — the product owner reads only granted evidence.** `curl -s -b rohan $BASE/api/ideas/$IDEA` returns `evidence`
  containing exactly the attached copy (`"id":"shared-view-contribution-c-delta-collections","title":"Tone guidance in
  collections reminders"`), first key `id`, and `grep -o` counts of `"author_id"`, `"tenant_id"`, `"body"`,
  `"internal_note"`, `"contribution_id"`, `"attribution_requested"` are all `0`. An unreadable id is a `404`:
  `curl -s -b rohan -X POST $BASE/api/ideas/$IDEA/evidence -d '{"shared_view_id":"shared-view-not-here"}'` →
  `{"error":"not found"}`. `tests/ideas.test.ts` asserts the grant set equals `evidenceGrantIds()` and excludes Cedar's
  copy; detaching twice gives `200` then `404`.
- **DoD — the client sees only approved update text.** `POST /api/ideas/$IDEA/public-update` as the product owner answers
  `"approved":false`; `curl -s -b maya $BASE/api/client/ideas | grep -c "writing the re-submission guidance"` → `0`;
  `curl -s -b rohan -X POST $BASE/api/ideas/$IDEA/public-update/approve` → `403 {"error":"forbidden"}`; after meera
  approves (the text appears once in `curl -s -b meera $BASE/moderate`) the same grep returns `1` on both
  `/api/client/ideas` and `/c/tenant-aurora/ideas`; a second approval is `409 {"error":"a moderator already approved
  this text"}`; `GET /api/notifications` as rohan contains `"kind":"idea.update.approved"`. The whole client payload is
  `{"id","title","status_plain","owner_team","offering_slug","approved_text","last_update_at"}` — `tests/ideas.test.ts`
  pins that key set and the live grep for `"priority"`, `"problem"`, `"Under review"`, `"internal_note"`,
  `"created_by"`, `"status":` is `0`.
- **DoD — an invalid status transition gives `409`.**
  `curl -s -b rohan -X PATCH $BASE/api/ideas/$IDEA/status -d '{"status":"Released","reason":"Skip the review…"}'` (from
  `Proposed`) → `409 {"error":"cannot move an idea from Proposed to Released"}` and the idea stays `Proposed`. A legal
  move → `200 {"item":{"id":…,"status":"Under review"},"note":"Status moved. The reason is in the internal history…"}`
  with `"next_statuses":["Planned","Not proceeding"]` and history row
  `"from_status":"Proposed","to_status":"Under review","reason":"The owning team has taken it up."`. A missing reason →
  `400 {"error":"a status and a reason are required","fields":{"reason":"Required"}}`; an unknown idea → `404`.
- **DoD — a report triggers suspension and tells the author.**
  `curl -s -b maya -X POST $BASE/api/reports -d '{"shared_view_id":"shared-view-contribution-c-beacon-seasonality","reason":"The bucket is narrow enough that one branch stands out."}'` →
  `{"report_id":"cb507554-…","suspended":true,…}`; in the same second `grep -c` on `/api/feed`, `/api/search?q=seasonal%20sales%20peaks`
  and `/api/export?format=json` all drop `1 → 0`, `/api/themes/seasonality-context` reports `"suppressed":true`,
  `"reason":"Fewer than the minimum number of organisations"`, `"evidence":[]`, and
  `GET /api/notifications` as `sam@beacon.example` carries `"kind":"report.suspension"`. The record itself stays
  Published — the moderator console shows `copy state suspended · record Published`.
- **Suspension reaches the product owner's evidence too.** Same flow against the Cedar copy: before the report the copy is
  a readable idea-evidence title (`readable titles: 1`, `feed: 1`); after it, `readable titles: 0`, `feed: 0`
  and the detached grant is named in `unavailable_grants` as `"id":"shared-view-…-cedar-seasonality","state":"suspended"`
  while the idea's internal `"status":"Under review"` is unchanged; a moderator `restore` returns both to `1`.
- **Report resolution is a moderator decision, and only once.** `curl -s -b maya -X POST $BASE/api/reports/$REPORT/resolve
  -d '{"decision":"restore"}'` → `403`; as meera → `{"decision":"restore","restored":true}` and the feed and the theme
  come back; the same report again → `409 {"error":"this report is already resolved"}`. `tests/reports.test.ts` proves a
  second open report on the same copy blocks the restore with `409` and leaves the report `open`.
- **`keep_out` uses the Section 9 write.** Second report + `{"decision":"keep_out"}` → `{"restored":false,"note":"Report
  upheld. The item is Unpublished…"}`, then `feed: 0`, `queue rows naming it: 0`, `open reports naming it: 0` and the
  author holds exactly one `"kind":"moderation.decision"` and one `"kind":"report.decision"`.
- **Reporting something that cannot be reported is a `404`** — a hidden copy and a draft-only contribution both answer
  `404`, anonymously `401 {"error":"unauthenticated"}` before any lookup.
- **Authority and cache headers.** Anonymous `GET /api/ideas` and `/api/client/ideas` → `401`; `dev.emp@azentio.com`
  (no `product.owner`) → `403` on `GET` and `POST /api/ideas`; `maya@aurora.example` → `403` on `/api/ideas` and `200`
  on `/api/client/ideas`. `curl -sD -` on an authorised idea read → `cache-control: no-store`.
- **Audit records allows and denies, and the chain holds.** `SELECT action, decision, COUNT(*) FROM audit_log WHERE
  action IN ('idea.write','idea.public_update','moderation.review','shared.report','read.ideas','moderation.unpublish')
  GROUP BY action, decision` on that database:
  `idea.write allow=19 deny=8`, `idea.public_update allow=2`, `moderation.review allow=14 deny=2`,
  `shared.report allow=8 deny=2`, `read.ideas allow=3 deny=1`, `moderation.unpublish allow=1`;
  `verifyChain()` → `{"ok":true,"rows":102,"firstBadId":null}`.
- **Pages.** `/employee/ideas` as rohan renders `Improvement ideas`, `Open an idea`, `Priority` (counts 1) and as
  `dev.emp` renders no form (`Open an idea: 0`); `/employee/ideas/$IDEA` shows `Priority (never shown to a client)`, the
  history reason and the status form; `/c/tenant-aurora/ideas` shows the plain-language status line, the limitations
  block and the approved text while `>Under review<`, a priority label and the history reason are each `0`; `/moderate`
  shows `Open reports on shared items`, `Client-facing updates waiting for you` and the `suspended` wording; the client
  learning feed offers `Report this item`; `/configurator` and `/playground` stay `404` until Phase 7.

### Known issues

- No weekly digest (Decision 65): the moderation queue and the pending-approval list carry the same information.
- A suspended copy is still named (by id) in `unavailable_grants` of the idea it was attached to; that is the product
  owner's internal view, and the readable `evidence` array is empty. Section 15 asks for the readable set only.
- `MODERATOR_APPROVED` is derived from `platform_grants`, so revoking `learning.moderate` from a moderator also hides the
  text they approved (Decision 56). No seeded account can both post and approve.
- Screens were verified by HTTP status plus rendered text, not by screenshot.

## Phase 7 — employee portal and Playground — DONE

### What is built

- `lib/playground.ts` — mulberry32 seed 42, 200-app portfolio, three scenarios with **Synthetic data** /
  **Simulated output, not a credit decision** badges; Islamic FI notice lines (AAOIFI / IFSB / IIFM awareness).
- `lib/playground-store.ts`, `POST /api/playground/run`, `POST /api/playground/feedback`; optional local Ollama assist
  (`qwen2.5-coder:7b`) via `lib/ollama.ts`.
- `GET /api/media/[id]` with `Range` → `206` / `Accept-Ranges: bytes`; files under `data/private-media/`.
- `GET/PUT /api/content/[key]`; publisher UI behind `content.publish`.
- Pages: `/employee` dashboard, `/employee/playground`, `/employee/live`, `/employee/library`, `/employee/publish`,
  `/c/[tenantId]/demo/[slug]` for entitled clients.
- Brand tokens from the reference site; bilingual EN/AR + RTL + Hijri date strip; AAOIFI/IFSB/IIFM copy on about/trust.

### Verified

- Client (`maya@aurora.example`) → `/api/media/media-employee-live` → **404**.
- Employee Range `bytes=0-9` → **206** with `Content-Range: bytes 0-9/94`.
- `dev.emp` PUT `/api/content/home.banner` → **403**; `kavya.pub` → **200**.
- `npm test` → 147 passed (Node 22.17.0). `npm run build` clean.

## Phase 8 — admin and Access Test Runner — DONE

### What is built

- Admin orgs/entitlements (`/api/admin/orgs`), two-person platform grants (`/api/admin/grants`, config-backed requests),
  invitations (`/api/invitations`, `/api/invitations/accept`, `/accept-invite/[token]`, `/c/[tenantId]/admin`).
- Access Test Runner AT-01…AT-12 (`/api/admin/test-runner` + Admin UI); result stored for `/trust`.
- Minimal `lib/aira.ts` + `POST /api/aira/ask` for AT-11 (public + visible shared only).

### Verified

- After `npm run seed`, Access Test Runner → **12/12 PASS**.
- Phase 7 DoD checks above still hold on the same build.

## Phase 9 — docs & hand-off — DONE (light)

### What is built

- README rewritten for full Phases 1–8 (quick start, accounts, 5-minute demo walkthrough, honest labels).
- `.env.example` documents optional `OLLAMA_BASE_URL`.
- Presentation notes remain in `PRESENTATION_LEEWAY.md`; decisions in `DECISIONS.md`.

### Remaining (optional polish)

- Deeper AIRA UX beyond the AT-11 stub; broader accessibility audit beyond tokens / landmarks already in place.
