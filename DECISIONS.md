# DECISIONS.md

Choices made where BUILD_SPEC.md left room, simplest option first. Grouped by phase.

## Phase 1 — scaffold, database, seed, public site

1. **Node runtime available here is v22, not v20.** The spec pins Node 20. This machine has no Node 20 install; the
   only usable runtime is a bundled Node v22.17.0. `package.json` declares `"engines": { "node": ">=20" }` so the
   project still runs on Node 20 as specified. Nothing in the code uses a post-20 API.
2. **`npm run seed` / `npm run reset` run `lib/seed.ts` through `tsx`.** The spec fixes `lib/seed.ts` as TypeScript
   and requires both commands, but names no runner. `tsx` (dev dependency, no service) is the smallest way to execute
   a `.ts` file directly. Both commands invoke the identical script, as the spec requires ("reset: same as seed").
3. **`DATA_DIR` is an optional override for the database directory**, defaulting to `data/`. It exists only so tests
   can seed into a temporary directory instead of mutating the developer's `data/app.db`. Unset in `.env.local`.
4. **`lib/db.ts` exposes `ensureSchema()` and the public site calls it before reading.** The spec assigns `db.ts`
   "connection + helpers". If `data/app.db` does not exist yet, the first read creates the schema from
   `lib/schema.sql` but leaves the tables empty, so the public pages fall back to the Section 19 constants in
   `lib/seed-data-core.ts` / `lib/seed-data-content.ts` rather than rendering an empty site. This keeps
   `npm run dev` usable before `npm run seed`; the seed remains the source of truth.
5. **Table names for the drop step live in `lib/schema-tables.ts`.** `lib/schema.sql` must be created exactly as
   specified, so it cannot gain `DROP TABLE` statements. Dropping "all data" on seed therefore needs a list, and a
   hand-maintained array is simpler than parsing SQL. `tests/seed.test.ts` asserts every table in the spec exists,
   which catches the list drifting out of sync.
6. **Seed data is split across three modules.** The spec forbids files over roughly 250 lines: `lib/seed.ts` is the
   insert logic, `lib/seed-data-core.ts` holds catalogue/accounts, `lib/seed-data-content.ts` holds contributions,
   themes, the idea, media and content blocks.
7. **Contribution titles, types and authors not given in Section 19 were filled in.** The spec gives exact shared
   summaries and bodies but not a `title` or `type` for contributions 2 and 3, and no author for the published ones.
   Titles are short paraphrases of the given summary; types come from the allowed enum (`operational_challenge` for
   the Beacon manual-adjustment item, `market_observation` for the Cedar survey item, `successful_practice` for the
   Delta reminder-tone item); authors are the tenant's `client_admin` except Aurora's, which is `maya@aurora.example`
   as the spec states. All four community items have `attribution_requested = 0`, so every `shared_views.attribution`
   is `NULL`.
8. **`contribution_flags` for the seeded Submitted item are written by a local three-pattern scan.** The full
   `lib/scanner.ts` (seven patterns) is Phase 4. Seeding needs the flags to exist so the moderator queue is not
   empty; the local helper covers only `email`, `amount` and `customer_name`, which are the three patterns the
   Section 19 body actually trips. It is a seed-time helper, not the product scanner.
9. **Placeholder media is plain text, and `public/banners/` is empty.** Section 19 says "Seed creates tiny
   placeholder files; label them 'Placeholder recording'". A text file is the smallest honest placeholder, written to
   `data/private-media/`. Streaming with `Range` is Phase 7, so `/media` labels each asset "streaming available in a
   later build phase" instead of linking to a file. No banner image is seeded, because there is no real brand asset
   to place there; the directory is reserved.
10. **`/trust` states that the Access Test Runner result is not available yet.** Section 18 wants the page to link to
    the latest result summary, but the runner is Phase 8 and rule 8 forbids claiming what the system does not do. The
    page explains the runner and shows an explicit "not available yet in this build" chip.
11. **`/login` exists in Phase 1 as a static notice, and "Sign in" stays in the nav.** Section 18 requires the Sign in
    nav item; authentication is Phase 2. Rather than a dead link, `/login` renders and states plainly that sign-in is
    not enabled in this build and that no code request is made.
12. **Public pages are server components reading SQLite directly.** Only `/api/public/products` and
    `/api/enquiries` exist, both on the spec's public list, so no `withAuth` is required yet. Pages marked
    `force-dynamic` so a rebuild never caches stale seed content.
13. **Design tokens are RGB channel triplets in `styles/tokens.css`.** `rgb(var(--c-accent) / <alpha-value>)` in the
    Tailwind config lets utilities such as `bg-surface/95` work while every colour still comes from one file. Values
    are neutral corporate defaults with the required "Replace values with Azentio brand tokens captured from
    azentio.com." comment; dark theme follows `prefers-color-scheme`.
14. **`tests/seed.test.ts` is the only Phase 1 test.** The spec's named test files (`policy`, `lifecycle`, `visible`)
    belong to later phases and would be empty stubs now. The seed test guards what Phase 1 actually builds: the full
    schema exists, Section 19 counts are exact, drafts never reach `shared_views`, and the seasonality topic spans
    three organisations while the collections topic spans one.

## Phase 2 — auth, sessions, policy, audit

15. **`session` is handled as a self-scope, not as a resource audience.** Section 17 gives `/api/me` and
    `/api/workspaces/switch` the audience "session", but Section 7.2 lists only five valid audiences and rule 1 of 7.3
    denies anything else. `authorize()` is therefore left byte-faithful to 7.3, and `withAuth` plus `protectPage`
    implement "session" as "a live server session is the only requirement" (401 without one). Non-self endpoints always
    pass a real Section 7.2 audience through `authorize()`.
16. **Rate-limited OTP requests still answer `{ ok: true }` with no code.** Section 6 says the response must never
    reveal whether an address exists; answering 429 would leak it. The slot is refused silently and the caller sees the
    same `{ ok: true }`. `POST /api/auth/verify` can answer 429, because at that point the caller already holds a code
    request for an address they claim.
17. **Deny codes on handlers, redirects on pages.** API handlers follow 7.4 exactly: 401 unauthenticated, 403
    `{ error: "forbidden" }`, 404 `{ error: "not found" }` when the tenant behind a record or a `[tenantId]` segment
    does not match the session. Protected pages cannot return those codes usefully, so an unauthenticated visitor is
    redirected to `/login` and a denied visitor sees an "Access denied" panel that quotes the same reason the audit row
    records. `/c/[tenantId]` is the exception: it renders a 404 there, matching the handler rule.
18. **The workspace switch returns 404, not 403, for an organisation the session user is not in.** The tenant id in the
    body is a target, not authority; treating an unaffiliated tenant id as "not found" keeps the response identical to
    the cross-tenant rule in 7.4 and avoids confirming which tenants exist.
19. **`needsWorkspaceChoice` is true only when there are two or more active memberships.** An employee with no
    membership gets no active tenant either, but asking them to choose an organisation they do not belong to would be
    misleading, so login answers `{ activeTenantId: null, needsWorkspaceChoice: false }` and the client lands in the
    employee area.
20. **The dev outbox reads the `notifications` rows, not a module-level array.** During `next dev` a recompile can give
    the route handler and the page separate module registries, so an in-memory queue loses the very first code. Section
    6 requires both (an in-memory array is an implementation note, the `notifications` row is the requirement), so the
    database is the source the page lists — newest 50, cleared by `npm run seed`. The queued message text carries the
    plaintext code because a demo that cannot show its own code cannot be signed in to; `otp_codes` itself stores only
    `sha256(code)`.
21. **Session cookies are `httpOnly`, `SameSite=Lax`, `Path=/`, `Secure` off only for `localhost`/`127.0.0.1`.** The
    host name decides, not `NODE_ENV`, so `npm run build && npm start` on a phone or tablet over the LAN still gets a
    working cookie while any deployed host gets `Secure`.
22. **`buildActor()` is rebuilt on every request.** Sessions store only `active_tenant_id`; membership status,
    entitlements and platform grants are re-read each time, so revoking a membership takes effect on the next request
    rather than at the next login (the rule in Section 16 that audience changes apply immediately).
23. **`/api/auth/logout` and `/api/workspaces/switch` sit behind `withAuth` with the `session` scope.** Section 6 does
    not mark them public, and rule 6 says every handler is wrapped or listed; wrapping them also keeps the import guard
    in `tests/policy.test.ts` honest — the guard's public exemption list stays exactly the four Section 7.4 entries.
24. **Phase 2 protected pages are thin but real.** `/c`, `/c/[tenantId]`, `/employee`, `/moderate`, `/admin` and
    `/admin/audit` exist to prove route protection and to show the active-organisation chip required by Section 23.
    They list the features that do not exist yet instead of linking to them, and `/moderate` and `/admin/audit` only
    ever count or read what the seed produced.
25. **`ex.member@aurora.example` can sign in and gets no tenant session.** Section 19 gives that account a revoked
    membership; making login fail would hide the point being demonstrated. The session is created with
    `active_tenant_id = NULL`, `setActiveTenant()` refuses it, every tenant audience denies it and the attempt is
    audited.
26. **Two new test files instead of stubs for later phases.** `tests/policy.test.ts` covers the Section 22 DoD list
    plus the `withAuth` import guard (with a fixture that proves the guard fails for an unwrapped handler), and
    `tests/session.test.ts` covers codes, rate limits, session lifetime, the employee rule, workspace switching and
    the audit chain. `visible.test.ts` still belongs to Phase 5; `lifecycle.test.ts` arrived with Phase 3 (see 37).
27. **Record-scoped routes take their audience from the database row and answer 404 on a tenant
    mismatch.** `ownerAudienceOf(params)` reads the contribution and returns `tenant:<owning tenant>`, or `null` when no
    such row exists. `withAuth` gained `record: true`, which turns the two cross-tenant denial reasons into 404
    (existence never leaks) while everything else still returns 403. The reason set is exported as
    `CROSS_TENANT_DENY_REASONS` so `tests/contributions.test.ts` asserts against the same list the wrapper uses instead
    of duplicating strings.
28. **A record route answers 401 before it answers 404 for an anonymous caller.** The record lookup happens before
    authorisation, so the order would otherwise reveal "this id exists" to someone with no session at all.

## Phase 3 — client portal and contributions

29. **`body` is returned only to the author.** Section 7.3 lets a colleague with `contribution.read.org` read the
    record, but the private source text is the author's own writing; `contributionDTO()` sets `body: null` for anyone
    else and the detail page says so plainly. Stricter than required, never looser.
30. **Phase 3 withdrew drafts and returned items only; Phase 5 added the rest.** Section 12's withdrawal is one
    transaction that deletes the shared view, drops evidence grants, bumps `visibility_epoch` and notifies product
    owners. Until it existed, `withdrawContribution()` returned 409 with "withdrawal of a published item arrives with
    the withdrawal phase" rather than pretending to purge. That placeholder is gone: `lib/withdraw.ts` now owns
    `withdrawContribution()` for all four withdrawable states, and `lib/contribution-writes.ts` no longer exports it.
31. **`lib/sharing-copy.ts` holds the sharing and consent copy plus the consent matrix, with no database import.**
    Client components cannot import `lib/consents.ts` (it pulls in `better-sqlite3`), and duplicating the words or the
    Section 11 table in the browser would let the preview drift from what the server records. Both now call the same
    `consentMatrix()`; `lib/consents.ts` re-exports them.
32. **"Draft save never changes sharing" is enforced in the SQL.** `editContribution()` updates the eight field
    columns and nothing else, so a PATCH cannot widen an audience, and the edit form deliberately omits the sharing
    radios. A draft's initial audience comes from the create form, because that choice is what decides whether
    colleagues can list the draft at all (Section 9).
33. **The client dashboard counts what this session may open, and never queries `shared_views`.** The Phase 2 stub
    counted shared views with its own join; Section 8 allows exactly one reader of that table, which arrives with the
    publishing phase. Counts now come from `listContributions(actor, "org")`, so a colleague's private draft is not
    counted anywhere on the page.
34. **The dashboard shows improvement ideas as a title and a plain status only**, for offerings the organisation is
    entitled to. Evidence, public updates and the idea workspace are Phase 6, and the card says so instead of linking.
35. **`/notifications` is a session-scoped page, not a tenant page.** A notification belongs to a person across
    organisations, so it uses the same `session` self-scope as the bell's API and appears outside `/c/[tenantId]`.
36. **`withAuth` answers 401 before it looks up any record.** The first Phase 3 sweep showed `GET /api/contributions`
    answering 403 for an anonymous caller: the list route derives its audience from the session, so with no session the
    audience came out empty, `authorize()` returned "missing or invalid audience" at step 1, and the "unauthenticated"
    branch at step 3 was never reached. Section 7.4 requires 401, and returning it first is also what keeps a 404 from
    confirming that an id exists, so the wrapper now audits the denial and returns 401 as soon as the cookie fails to
    produce a live session.
37. **Phase 3 modules split by length keep the read rules and the mutations apart.** Three files passed 250 lines, so
    each was cut along a seam that already exists in the spec rather than arbitrarily:
    `lib/contributions.ts` (reads, the Section 9 visibility rule and the DTO) / `lib/contribution-writes.ts`
    (create, edit, submit, withdraw); `components/observation-form.tsx` (state and the POST/PATCH call) /
    `components/observation-fields.tsx` (the eight field controls); and
    `tests/contributions.test.ts` (who may see what) / `tests/lifecycle.test.ts` (the Section 11 consent matrix and the
    Section 9 transitions). Section 22 names `lifecycle.test.ts` in the Phase 4 DoD; it starts here with the transitions
    Phase 3 can reach and the moderation and publishing transitions are added to it in Phase 4. No behaviour changed —
    the same 38 HTTP checks and the same 50 assertions pass before and after the split, and each page or route imports
    only the half it needs.
38. **The four extra Phase 3 rules get their own file, `tests/portal-rules.test.ts`, rather than more assertions in the
    suites that already prove them.** Each rule is a boundary between two modules (notification channel filtering, the
    session as the only tenant source, the viewer's absent permission plus the draft sharing rule, and the field list an
    edit may write), so one file that signs in as four different seeded accounts and asserts all four boundaries keeps the
    failure message readable. The same four rules are additionally proven over HTTP on a freshly seeded database; the
    commands and their exact output are in the Phase 3 Definition of Done in `PROGRESS.md`.

## Phase 4 — moderation, publishing, feed and search

39. **A community-facing response says `notice`, never `note`.** `FORBIDDEN_SHARED_KEYS` lists `note` and `notes`, and the
    DoD greps a whole payload for those key names, so an explanatory sentence in the feed, search or report envelope would
    fail the check while carrying no data at all. `app/api/feed`, `app/api/search` and `POST /api/reports` now return
    `notice`; the moderation action endpoints, which only an employee can reach and whose payload is not shared content,
    keep `note`.
40. **`GET /api/moderation/[id]` is an addition to the Section 17 table.** The review screen needs the record, its hints,
    its decisions and its consents in one read, and Section 7.3 decides inside that response whether `body` is present.
    `internal_note` is deliberately absent from the JSON: it belongs to `moderation_decisions` and is rendered server-side
    on the console, so it never travels in a payload a client could be handed.
41. **A protected page guards itself, not only its layout.** `app/moderate/layout.tsx` already answers with a denial
    shell, but Next still serialises the child page segment into the response body, so the private submission appeared in
    the flight payload of an account that was shown "Access denied". Both pages now fail closed on their own — the queue
    returns `null`, the review screen calls `notFound()` because a denied record-scoped read is a missing page — and the
    live sweep asserts the private strings are absent from the body, not merely hidden by CSS.
42. **The page guard asks the policy engine, the same question the API asks.** The first version of that guard wrote
    `effectivePermissions(actor).includes("moderation.review")`, which compares an *action* name against a list of
    *permission* names: the seeded moderator, whose grant is `learning.moderate`, got the denial shell while every
    moderation endpoint answered 200 for her. Both pages now call
    `authorize(actor, "moderation.review", { audience: "employee" })`, so a screen and its endpoint cannot drift, and
    `tests/moderation.test.ts` asserts the check is true for the moderator and false for a client.
43. **Republishing reuses the same `shared-view-<contribution>` row.** A publish inserts it, an unpublish sets it to
    `suspended`, a re-publish sets it back to `live`. One id per contribution keeps a report, a withdrawal and a
    re-publish pointed at the same object and removes any "which version is live" tie-break from the read path.
44. **The scanner runs inside the submit transaction and re-scans on re-submit.** Hints describe the text as it stands,
    so a Returned item that the author fixes comes back with the new list rather than the old one;
    `tests/lifecycle.test.ts` asserts both the fresh hints on submit and the empty list after a correction.
45. **A report stores, opens in the console and notifies; it does not suspend — yet.** Section 22 puts "report triggers
    suspension and author notification" in Phase 6, and Section 9 already lets a moderator unpublish while a report is
    open, which the live sweep shows (`unpublish` on a reported item: 200, and the item leaves feed, search and export in
    the same request).
46. **Two more length splits, both along seams the spec already draws.** `components/review-actions.tsx` reached 294
    lines, so the Section 10.3 publish form (and the `usePost`/`Status` pair it shares with the transitions) moved to
    `components/moderation-form.tsx`: 155 and 152 lines, one file for the whitelist the community may receive and one for
    the Section 9 moves. Phase 4's tests are split the same way — `tests/lifecycle.test.ts` for the scanner gate,
    `tests/moderation.test.ts` for the moderator's actions and the published copy, `tests/moderation-fixtures.ts` for the
    item both build. `lib/publish.ts` (256) and `tests/lifecycle.test.ts` (260) sit at the boundary and stay whole: each
    is one seam, and cutting them would only rename imports.

## Phase 5 — withdrawal, cohort guard, themes

47. **`Unpublished → Withdrawn` was added to the Section 9 table.** Section 9 lists no edge from Unpublished to
    Withdrawn, while Section 12 names Unpublished as one of the four withdrawable states. The two sections cannot both
    be honoured, so the state machine gained the edge with the same actor and guard as `Published → Withdrawn`: an
    unpublished item still has a shared row (state `suspended`) that its author is entitled to remove for good, and
    refusing that would leave the author stuck with a record they can neither publish nor delete.
48. **One `withdrawContribution()` for all four states, not two paths.** The transaction runs its `DELETE FROM
    shared_views` and its grant cleanup unconditionally — for a Draft or Returned item both statements remove nothing, so
    there is no second code path to keep in sync. The difference shows in the response: `clock` is `null` when no shared
    row existed, and the notice says a draft never reached anyone, instead of reporting a timing result for work that was
    not done.
49. **The clock's `aira` check is the citation pool, not an answer.** Phase 9 builds AIRA's answerer. What exists today
    is the set it will be allowed to cite — `visibleSharedViews()` plus the public content blocks — and the check is that
    the withdrawn ids are gone from both. The card labels it "AIRA citation pool" so the UI does not claim an answer
    engine that is not there yet.
50. **The clock is measured as the acting user.** Section 12 says the API "re-queries as a community-level actor". The
    route's audience is `tenant:<owner>`, and every actor who can reach it — the author or an organisation admin — has an
    active organisation, which is exactly what `authorize(…, { audience: "community" })` requires. So the acting session
    is the community-level actor; a moderator cannot withdraw another person's item (Section 9 gives that transition to
    the author side), so there is no second actor to measure with.
51. **An unauthorised reader gets the suppressed shape, and the denial is audited.** `themeVisibility()` calls
    `authorize()` itself before counting anything, so a page that forgets its own guard still shows withheld text rather
    than a theme. This mirrors `visibleSharedViews()` and is asserted with a `null` actor in `tests/cohort.test.ts`.
52. **`orgBucket` is the only number-shaped thing a theme returns, and it is a bucket.** The distinct-organisation count
    stops inside `lib/cohort.ts`: the visible payload carries `"3 or more organisations"`, a small-sample warning while
    the count is under 5, and the theme's limitation text; the suppressed payload carries the reason and no counts,
    quarters, description or evidence. Filters narrow the counted set (`period`, `q`), so a theme can drop below the
    minimum in one quarter and disappear — that is the guard, and `tests/cohort.test.ts` proves both directions.
53. **`authorNextStates()` became `actorNextStates(from, { isAuthor, isOrgAdmin })`.** The old helper read
    `author-or-org-admin` as admin-only, so the Withdraw button vanished from the author of a published item — exactly
    the Section 12 action this phase exists to expose. Both flags are now passed and the rule is read literally;
    `tests/lifecycle.test.ts` pins the button off for a colleague's draft and on for the author of a published record.
54. **Section 18's "bookmarks" on the learning page are not built.** Section 5 has no bookmarks table, and Section 0
    forbids adding features or schema the spec does not define, so the feed page ships with filters, search, themes and
    exports and this line records the omission rather than inventing storage for it.

## Phase 6 — improvement ideas, status loop, reports

55. **Section 17 is read as "what each route must prove", not as a list of HTTP verbs.** The table names actions
    (`create idea`, `move status`, `grant evidence`, `report shared item`) without saying which verb or path they use.
    Each became one RESTful route: `POST /api/ideas`, `PATCH /api/ideas/[id]`, `PATCH /api/ideas/[id]/status`,
    `POST|DELETE /api/ideas/[id]/evidence`, `POST /api/ideas/[id]/public-update`, `POST /api/reports`,
    `POST /api/reports/[id]/resolve`. Every one of them passes through `withAuth` with an explicit action.
56. **A client-facing idea update is approved when its `approved_by` currently holds `learning.moderate`.**
    `idea_public_updates` has no pending flag and Section 5 does not allow adding one, so `MODERATOR_APPROVED` in
    `lib/ideas.ts` is a derived `EXISTS` over `platform_grants`. Consequence: a product owner's new text is stored and
    is invisible to every client page until a moderator acts, and a moderator who later loses the grant stops making
    old text visible — which is the correct behaviour for a revocation, not a bug.
57. **Approval is a separate endpoint, not a flag on the post.** `POST /api/ideas/[id]/public-update` requires
    `idea.public_update` (product owner) and `POST /api/ideas/[id]/public-update/approve` requires `moderation.review`.
    The poster must not be able to publish their own client text, and one account holds `product.owner` while another
    holds `learning.moderate`, so no seeded user can satisfy both. Approving re-points `approved_by` at the moderator
    and refreshes `at`; a second approval of the same row is a `409`.
58. **A report suspends the shared copy and leaves the author's record Published.** Section 17 says a report "triggers
    suspension"; Section 16 says only a moderator may unpublish. So `reportSharedView()` sets `shared_views.state =
    'suspended'` and never touches `contributions.state`. The item vanishes from feed, search, CSV export, theme
    evidence, cohort counts and idea evidence at once (all of them read through `lib/visible.ts`), while the author's
    own portal record and its edit history stay intact for the moderator to judge against.
59. **`lib/view-state.ts` is a fourth writer over `shared_views`, and it only ever UPDATEs the `state` column.**
    Section 8 names the modules allowed to touch that table; the report path needed a writer that changes visibility
    without deleting a row, so this small module was added to that list rather than importing `publish.ts` into the
    moderation flow. It contains no SELECT — reading shared content still belongs to `lib/visible.ts` alone.
60. **Two routes not written literally in Section 17 exist because the phase needs them.** `PATCH /api/ideas/[id]`
    (product owner edits title/problem/priority/offering/theme) and `DELETE /api/ideas/[id]/evidence` (detach a
    citation). Both use the same record-derived audience and `idea.write` action as the idea routes that are listed, so
    they add no new authority.
61. **Report resolution lives at `POST /api/reports/[id]/resolve` with `restore` or `keep_out` in the body.**
    A second collection (`/api/reports`) already lists the queue; the spec puts the moderator decision on the report,
    so one endpoint with an enum in the payload is simpler than two paths. `keep_out` runs the existing
    `unpublishContribution()`, which is the Section 16 write, so the report flow never duplicates it.
62. **Restoring is refused while another open report names the same copy.** `resolveReport()` checks for other open
    reports on that `shared_view_id` before it mutates anything and answers `409`. Without it, one moderator could put
    back on the feed an item a second reporter is still waiting on; the check also means a rejected `restore` leaves
    the report open and the copy suspended, exactly as before the call.
63. **`clientIdeas()` is the only way any client page reads an idea.** Section 14 lets a client see plain-language
    status, owner team, offering and moderator-approved text — nothing else. The tenant dashboard previously ran its
    own SQL and printed the raw internal status; that query is deleted and the dashboard now calls `clientIdeas()`, so
    `priority`, `status`, `problem_statement`, `internal_note`, `created_by`, dates and status reasons cannot reach a
    client page or API response even by accident.
64. **The idea status machine lives in `lib/idea-lifecycle.ts` as data, mirroring Section 14 exactly.** Transitions go
    forward only or to `Not proceeding`, never backwards; `Proposed` must pass through `Under review`. An illegal move
    answers `409` before any row is written. `IDEA_STATUS_PLAIN` is the client wording and `IDEA_PRIORITIES` is
    internal-only, so the two vocabularies can never be confused by a caller.
65. **No weekly digest is built.** Section 22 lists a weekly email among the Phase 6 surfaces. Section 0 forbids
    pretending a message was delivered, there is no scheduler in the stack and Section 5 has no digest table, so the
    digest is recorded here as a deliberate omission; the moderation queue and the pending-approval list give the same
    information on a page instead.

## Phase 7 — employee portal and Playground

66. **Playground engines stay deterministic; Ollama is optional explanation only.** Section 20 and the stack ban
    external APIs for product behaviour. `lib/playground.ts` remains the sole source of numbers. `lib/ollama.ts` calls
    local `qwen2.5-coder:7b` only when the client sets `assist: true`, labels the result honestly, and never overrides
    the engine. If Ollama is down the run still succeeds.
67. **`PUT /api/content/[key]` uses audience `employee`, not the block's stored audience.** Section 7.3 step 2 makes
    `public` read-only, so a write against `home.banner` (audience `public`) would always deny before `content.publish`
    is checked. The PUT therefore authorises as an employee write; GET still uses the block's own audience so public
    banners stay publicly readable.
68. **`withAuth` allows unauthenticated public reads.** Media and public content blocks need anonymous `read.*` on
    audience `public`. The wrapper resolves audience first, then lets `authorize()` allow null actors for public reads;
    everything else still answers 401 before existence leaks.
69. **Brand tokens come from the reference prototype.** `styles/tokens.css` uses `#171b3a`, `#69D393`, `#102031`,
    `#f5f7f9`, `#607080` captured from https://azentio-ai-ipad.ssaha999.chatgpt.site/, keeping the required
    "Replace values with Azentio brand tokens…" comment.

## Phase 8 — admin and Access Test Runner

70. **Pending platform grants live in `config` as JSON.** Section 5 has no `grant_requests` table. Keys
    `grant_request:<uuid>` hold the request/approve/reject state; two different `platform.role.grant` holders are still
    required.
71. **AIRA arrives as a minimal keyword retriever in Phase 8** so AT-11 can run. Full Phase 9 polish can replace scoring;
    the rule already holds: only public blocks and `visibleSharedViews`, never employee or private content.
72. **Bilingual / RTL / Hijri is presentation only.** Locale cookie `az_locale` (`en`|`ar`) sets `dir` and copy; it never
    carries a role, tenant or permission. Hijri dates use `Intl` with `u-ca-islamic`. AAOIFI / IFSB / IIFM appear as
    awareness copy, never as a certification claim.
73. **Access Test Runner AT-03 reads the stored row, not the DTO.** `contributionDTO` omits `tenant_id` so existence of
    the organisation id never travels to the browser; the runner confirms Aurora ownership with a server-side SELECT.
74. **AT-08 judges search hits from `items[]` only.** The search envelope echoes `query`, which must not count as the
    withdrawn summary still being present.
